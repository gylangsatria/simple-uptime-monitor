const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const { parseServices } = require("./services");

const app = express();
const PORT = process.env.PORT || 5090;
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "data", "uptime.db");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== INISIALISASI DATABASE =====
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    service_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('up', 'down')),
    status_code INTEGER,
    response_time INTEGER,
    error TEXT,
    checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_checks_url_checked
  ON checks(service_url, checked_at DESC)
`);

// Migrasi baris lama ("YYYY-MM-DD HH:MM:SS" UTC) ke ISO-8601 UTC ("...T...Z")
db.exec(`
  UPDATE checks
  SET checked_at = replace(checked_at, ' ', 'T') || 'Z'
  WHERE checked_at NOT LIKE '%Z'
`);

// Prepared statements
// checked_at ditulis eksplisit sebagai ISO-8601 UTC, supaya tidak bergantung pada
// DEFAULT kolom (database lama masih memakai format "YYYY-MM-DD HH:MM:SS").
const insertCheck = db.prepare(`
  INSERT INTO checks (service_name, service_url, status, status_code, response_time, error, checked_at)
  VALUES (@name, @url, @status, @statusCode, @responseTime, @error, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
`);

// Layanan yang pernah dipantau tapi kini tidak ada di SERVICES tetap tampil di
// halaman history (data historis tidak hilang saat daftar layanan diubah).
const missingServices = db.prepare(`
  SELECT service_name AS name, service_url AS url
  FROM checks c
  WHERE c.id = (SELECT MAX(id) FROM checks WHERE service_url = c.service_url)
  ORDER BY service_url ASC
`);

const getRecentChecks = db.prepare(`
  SELECT * FROM (
    SELECT * FROM checks
    WHERE service_url = ?
    ORDER BY checked_at DESC, id DESC
    LIMIT ?
  ) ORDER BY checked_at ASC, id ASC
`);

function mapRow(row) {
  return {
    timestamp: row.checked_at,
    status: row.status,
    statusCode: row.status_code,
    responseTime: row.response_time,
  };
}

// Batas hari (waktu lokal server) -> ISO UTC, supaya filter tanggal akurat
function dayBound(date, endOfDay) {
  const d = new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// SERVER_HISTORY_POINTS: jumlah check terakhir yang dikirim ke bar chart dashboard
const HISTORY_POINTS = 48;
// HISTORY_LIMIT: batas maksimum baris per layanan di halaman history
const HISTORY_LIMIT = 2000;

// ===== KONFIGURASI LAYANAN (dari env SERVICES) =====
// Contoh: SERVICES="Google|https://google.com, WinPoin|https://winpoin.com"
const services = parseServices(process.env.SERVICES);

if (!services.length) {
  console.warn(
    "SERVICES kosong/tidak valid. Set di .env, mis: SERVICES=\"Google|https://google.com\"",
  );
}

// ===== FUNGSI CEK SATU LAYANAN =====
async function checkService(service) {
  const startTime = Date.now();

  try {
    const response = await axios.get(service.url, {
      timeout: 5000,
      validateStatus: () => true,
    });

    const status = response.status < 400 ? "up" : "down";

    insertCheck.run({
      name: service.name,
      url: service.url,
      status: status,
      statusCode: response.status,
      responseTime: Date.now() - startTime,
      error: null,
    });

    return {
      name: service.name,
      url: service.url,
      status: status,
      statusCode: response.status,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    insertCheck.run({
      name: service.name,
      url: service.url,
      status: "down",
      statusCode: error.response?.status || 0,
      responseTime: null,
      error: error.message,
    });

    return {
      name: service.name,
      url: service.url,
      status: "down",
      statusCode: error.response?.status || 0,
      responseTime: null,
      lastChecked: new Date().toISOString(),
      error: error.message,
    };
  }
}

// ===== ENDPOINT CEK STATUS =====
app.get("/api/status", async (req, res) => {
  try {
    const results = await Promise.all(
      services.map(async (service) => {
        const result = await checkService(service);
        const rows = getRecentChecks.all(service.url, HISTORY_POINTS);
        return { ...result, history: rows.map(mapRow) };
      }),
    );

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== ENDPOINT HISTORY DETAIL =====
app.get("/api/history", async (req, res) => {
  try {
    const { search, status, from, to } = req.query;

    // Refresh semua service dulu
    await Promise.all(services.map((s) => checkService(s)));

    // Layanan dari env + layanan yang hanya ada di database (sudah dihapus dari SERVICES)
    const configured = new Set(services.map((s) => s.url));
    const allServices = [
      ...services,
      ...missingServices.all().filter((s) => !configured.has(s.url)),
    ];

    // Filter service list by search keyword
    let filteredServices = allServices;
    if (search) {
      const q = search.toLowerCase();
      filteredServices = allServices.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q),
      );
    }

    const results = await Promise.all(
      filteredServices.map(async (service) => {
        const conditions = ["service_url = ?"];
        const params = [service.url];

        if (status === "up" || status === "down") {
          conditions.push("status = ?");
          params.push(status);
        }

        if (from) {
          const bound = dayBound(from, false);
          if (bound) {
            conditions.push("checked_at >= ?");
            params.push(bound);
          }
        }

        if (to) {
          const bound = dayBound(to, true);
          if (bound) {
            conditions.push("checked_at <= ?");
            params.push(bound);
          }
        }

        const rows = db
          .prepare(
            `SELECT * FROM checks
             WHERE ${conditions.join(" AND ")}
             ORDER BY checked_at ASC, id ASC
             LIMIT ?`,
          )
          .all(...params, HISTORY_LIMIT);

        const history = rows.map(mapRow);
        const last = history.length > 0 ? history[history.length - 1] : null;

        return {
          name: service.name,
          url: service.url,
          status: last ? last.status : "unknown",
          statusCode: last ? last.statusCode : null,
          responseTime: last ? last.responseTime : null,
          lastChecked: last ? last.timestamp : null,
          history,
        };
      }),
    );

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== ROUTE UTAMA =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== GRACEFUL SHUTDOWN =====
process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  db.close();
  process.exit(0);
});

// ===== START SERVER =====
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Uptime Monitor running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/status`);
  console.log(`Database: ${DB_PATH}`);
});
