const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 5090;
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "data", "uptime.db");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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
    checked_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_checks_url_checked
  ON checks(service_url, checked_at DESC)
`);

// Prepared statements
const insertCheck = db.prepare(`
  INSERT INTO checks (service_name, service_url, status, status_code, response_time, error)
  VALUES (@name, @url, @status, @statusCode, @responseTime, @error)
`);

const getRecentChecks = db.prepare(`
  SELECT * FROM checks
  WHERE service_url = ?
  ORDER BY checked_at ASC
  LIMIT ?
`);

const getAllChecks = db.prepare(`
  SELECT * FROM checks
  WHERE service_url = ?
  ORDER BY checked_at ASC
`);

function mapRow(row) {
  return {
    timestamp: row.checked_at,
    status: row.status,
    statusCode: row.status_code,
    responseTime: row.response_time,
  };
}

// ===== KONFIGURASI LAYANAN =====
const services = [
  { name: "Google", url: "https://google.com" },
  { name: "WinPoin", url: "https://winpoin.com" },
  { name: "Portofolio", url: "https://gylang.my.id" },
  { name: "Personal Blog Gylang", url: "https://blog.gylang.my.id" },
  {
    name: "MyBike - Management Kendaraan",
    url: "https://my-bike.gylang.my.id",
  },
  { name: "API Harga BBM", url: "https://api.gylang.my.id/api/harga-bbm" },
];

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
        const rows = getRecentChecks.all(service.url, 24);
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

    // Filter service list by search keyword
    let filteredServices = services;
    if (search) {
      const q = search.toLowerCase();
      filteredServices = services.filter(
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
          conditions.push("checked_at >= ?");
          params.push(from);
        }

        if (to) {
          conditions.push("checked_at <= ?");
          params.push(to);
        }

        const rows = db
          .prepare(
            `SELECT * FROM checks
             WHERE ${conditions.join(" AND ")}
             ORDER BY checked_at ASC
             LIMIT 5000`,
          )
          .all(...params);

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
