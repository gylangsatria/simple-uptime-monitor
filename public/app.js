// ===== UTIL =====
// Nama/URL layanan berasal dari server (config) atau pesan error, tapi tetap di-escape
// supaya tidak bisa menyuntikkan HTML/title attribute.
function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Guard request: tombol refresh dikunci saat request jalan, request bertumpuk dibatalkan.
let statusInFlight = false;
let historyInFlight = false;
let lastStatus = [];
let lastHistory = [];
let lastStatusAt = null;
let lastHistoryAt = null;

// ===== i18n — BAHASA INGGRIS & INDONESIA =====
const LANG_STORAGE_KEY = "uptime-lang";

const translations = {
  id: {
    title: "Uptime Monitor - Status Layanan",
    navDashboard: "Dashboard",
    navHistory: "History Down",
    dashboardTitle: "Status Layanan",
    dashboardSubtitle: "Monitor ketersediaan layanan secara real-time",
    totalLayanan: "Total Layanan",
    onlineLabel: "Online",
    offlineLabel: "Offline",
    refreshBtn: "\u{1F504} Refresh Status",
    historyTitle: "History Down",
    historySubtitle: "Riwayat lengkap kapan layanan down dan up",
    footerText: "Terakhir diperbarui:",
    checkingServices: "\u{1F50D} Mengecek layanan...",
    fetchFailed: "Gagal memuat data",
    tryAgain: "Coba Lagi",
    noServices: "Tidak ada layanan yang dikonfigurasi",
    online: "Online",
    offline: "Offline",
    onlineBadge: "{check} Online",
    offlineBadge: "{cross} Offline",
    loadingHistory: "\u{1F50D} Memuat riwayat...",
    fetchHistoryFailed: "Gagal memuat riwayat",
    noHistoryData: "Tidak ada data riwayat",
    na: "N/A",
    consecutiveChecks: "{count} check berturut-turut",
    searchPlaceholder: "Cari layanan...",
    filterAll: "Semua",
    filterFrom: "Dari",
    filterTo: "Sampai",
    locale: "id-ID",
    clickDetail: "Klik untuk detail riwayat",
    appTagline: "Monitor status layanan",
    uptimeLast: "Latency {count} check terakhir",
    latencyChart: "Grafik latency layanan",
    responseTime: "Waktu respons",
    avgResponse: "Rata-rata respons",
    noResponse: "Tidak ada respons",
    legendUp: "Online",
    legendDown: "Offline",
    legendAvg: "Rata-rata latency",
    lastCheckLabel: "Check terakhir",
    olderChecks: "{count} check lama disembunyikan",
    checkAt: "{status} pada {time}",
    detailToggle: "Detail riwayat",
  },
  en: {
    title: "Uptime Monitor - Service Status",
    navDashboard: "Dashboard",
    navHistory: "Down History",
    dashboardTitle: "Service Status",
    dashboardSubtitle: "Monitor service availability in real-time",
    totalLayanan: "Total Services",
    onlineLabel: "Online",
    offlineLabel: "Offline",
    refreshBtn: "\u{1F504} Refresh Status",
    historyTitle: "Down History",
    historySubtitle: "Complete history of when services went down and up",
    footerText: "Last updated:",
    checkingServices: "\u{1F50D} Checking services...",
    fetchFailed: "Failed to load data",
    tryAgain: "Try Again",
    noServices: "No services configured",
    online: "Online",
    offline: "Offline",
    onlineBadge: "{check} Online",
    offlineBadge: "{cross} Offline",
    loadingHistory: "\u{1F50D} Loading history...",
    fetchHistoryFailed: "Failed to load history",
    noHistoryData: "No history data available",
    na: "N/A",
    consecutiveChecks: "{count} consecutive checks",
    searchPlaceholder: "Search service...",
    filterAll: "All",
    filterFrom: "From",
    filterTo: "To",
    locale: "en-US",
    clickDetail: "Click for history details",
    appTagline: "Service status monitor",
    uptimeLast: "Latency of last {count} checks",
    latencyChart: "Service latency chart",
    responseTime: "Response time",
    avgResponse: "Avg response",
    noResponse: "No response",
    legendUp: "Online",
    legendDown: "Offline",
    legendAvg: "Average latency",
    lastCheckLabel: "Last check",
    olderChecks: "{count} older checks hidden",
    checkAt: "{status} at {time}",
    detailToggle: "History details",
  },
};

let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || "id";

function t(key, params = {}) {
  let text = translations[currentLang][key] || translations["id"][key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

function locale() {
  return translations[currentLang].locale;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  document.documentElement.lang = lang === "id" ? "id" : "en";
  applyStaticTranslations();
  // Render ulang dari data yang sudah ada — tidak memanggil API lagi.
  updateFooterTimestamp();
  const activePage = document.querySelector(".page:not(.hidden)")?.id;
  if (activePage === "page-dashboard" && lastStatus.length) renderServices(lastStatus);
  else if (activePage === "page-history" && lastHistory.length) renderHistory(lastHistory);
}

function toggleLanguage() {
  setLanguage(currentLang === "id" ? "en" : "id");
}

// ===== TEMA (LIGHT / DARK) =====
// Definisinya ada di <head> (window.toggleTheme) supaya tombol tema bekerja
// walau app.js belum selesai dimuat. Di sini hanya sinkronisasi atribut aksesibilitas.
function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.setAttribute("aria-pressed", String(dark));
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (el.placeholder !== undefined) {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });
  const toggleBtn = document.getElementById("langToggle");
  if (toggleBtn) toggleBtn.textContent = currentLang === "id" ? "EN" : "ID";
}

// ===== NAVIGASI =====
function showPage(pageName) {
  const target = document.getElementById(`page-${pageName}`);
  if (!target) return;
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.add("hidden");
  });
  target.classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.dataset.active = String(item.dataset.page === pageName);
  });
  if (pageName === "history") {
    loadHistoryData();
  }
}

// ===== FUNGSI CEK STATUS VIA API =====
async function checkAllServices() {
  if (statusInFlight) return;
  statusInFlight = true;
  const btn = document.querySelector('[data-i18n="refreshBtn"]');
  if (btn) btn.disabled = true;

  // Render hanya saat data benar-benar belum ada, supaya refresh tidak berkedip.
  const listElement = document.getElementById("servicesList");
  if (!lastStatus.length) {
    listElement.innerHTML = `<div class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">${t("checkingServices")}</div>`;
  }

  try {
    const response = await fetch("/api/status");
    const result = await response.json();

    if (!result.success) throw new Error(result.error || t("fetchFailed"));

    lastStatus = result.data;
    lastStatusAt = result.timestamp;
    renderServices(result.data);
    updateSummary(result.data);
    updateFooterTimestamp();
  } catch (error) {
    console.error("Error fetching status:", error);
    if (!lastStatus.length) {
      listElement.innerHTML = `
        <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          ❌ ${t("fetchFailed")}: ${esc(error.message)}
          <br /><br />
          <button type="button" onclick="checkAllServices()" class="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95">
            ${t("tryAgain")}
          </button>
        </div>
      `;
    }
  } finally {
    statusInFlight = false;
    if (btn) btn.disabled = false;
  }
}


// ===== TONE WARNA UPTIME =====
function uptimeTone(percent) {
  if (percent >= 99) return "text-emerald-600 dark:text-emerald-400";
  if (percent >= 95) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}


// ===== GRAFIK LATENCY =====
// Grafik area + garis: sumbu X = waktu (1 titik = 1 check), sumbu Y = response time
// (skala log tetap, sama seperti barHeight). Warna titik = status.
// Area downtime ditandai kolom merah tipis di belakang grafik.
const CHART_W = 720;
const CHART_H = 96;
const CHART_PAD = 4; // ruang atas/bawah agar titik tidak terpotong
const CHART_TOP = CHART_PAD;
const CHART_BOTTOM = CHART_H - CHART_PAD;

function chartGrid(history) {
  // gridline latency: 100ms, 1s — hanya kalau ada nilai latency di data
  if (!history.some((h) => typeof h.responseTime === "number")) return { lines: "", labels: "" };
  const marks = [
    { ms: 100, label: "100ms" },
    { ms: 1000, label: "1s" },
  ];
  const at = (ms) => CHART_TOP + UptimeCore.latencyScale(ms) * (CHART_BOTTOM - CHART_TOP);
  return {
    lines: marks
      .map(
        (m) =>
          `<line x1="0" x2="${CHART_W}" y1="${at(m.ms).toFixed(1)}" y2="${at(m.ms).toFixed(1)}" class="stroke-slate-200 dark:stroke-slate-700" stroke-width="1" stroke-dasharray="4 4" />`,
      )
      .join(""),
    // label di luar SVG supaya ukurannya tetap (SVG di-stretch horizontal)
    labels: marks
      .map(
        (m) =>
          `<span class="absolute left-1 -translate-y-1/2 rounded bg-white/70 px-1 text-[9px] leading-none text-slate-400 dark:bg-slate-900/70 dark:text-slate-500" style="top:${at(m.ms).toFixed(1)}px">${m.label}</span>`,
      )
      .join(""),
  };
}

function renderChart(history, loc) {
  if (!history.length) {
    return `<p class="py-6 text-center text-xs text-slate-400 dark:text-slate-500">${t("noHistoryData")}</p>`;
  }

  const n = history.length;
  const step = n > 1 ? CHART_W / (n - 1) : 0;
  const x = (i) => (n > 1 ? i * step : CHART_W / 2);
  const y = (h) =>
    CHART_TOP + UptimeCore.latencyScale(h.responseTime) * (CHART_BOTTOM - CHART_TOP);

  // area downtime
  const downBand = history
    .map((h, i) =>
      h.status === "down"
        ? `<rect x="${(x(i) - Math.max(step / 2, 1.5)).toFixed(1)}" y="${CHART_TOP}" width="${Math.max(step, 3).toFixed(1)}" height="${CHART_BOTTOM - CHART_TOP}" class="fill-red-500/15" />`
        : "",
    )
    .join("");

  // garis: hanya menyambung titik yang punya latency
  const measured = history.map((h, i) => ({ h, i })).filter(({ h }) => typeof h.responseTime === "number");
  const line =
    measured.length > 1
      ? `<polyline points="${measured.map(({ h, i }) => `${x(i).toFixed(1)},${y(h).toFixed(1)}`).join(" ")}" fill="none" class="stroke-indigo-500 dark:stroke-indigo-400" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />`
      : "";

  // area di bawah garis
  const area =
    measured.length > 1
      ? `<polygon points="${x(measured[0].i).toFixed(1)},${CHART_BOTTOM} ${measured
          .map(({ h, i }) => `${x(i).toFixed(1)},${y(h).toFixed(1)}`)
          .join(" ")} ${x(measured[measured.length - 1].i).toFixed(1)},${CHART_BOTTOM}" class="fill-indigo-500/10 dark:fill-indigo-400/10" />`
      : "";

  // titik per check
  const dots = history
    .map((h, i) => {
      const time = new Date(h.timestamp).toLocaleString(loc);
      const status = t(h.status === "up" ? "online" : "offline");
      const detail = typeof h.responseTime === "number" ? ` — ${h.responseTime}ms` : "";
      const code = h.statusCode ? ` — HTTP ${h.statusCode}` : "";
      const cls =
        h.status === "up"
          ? "fill-emerald-500 stroke-white dark:stroke-slate-900"
          : "fill-red-500 stroke-white dark:stroke-slate-900";
      const pos = h.status === "down" && typeof h.responseTime !== "number" ? CHART_BOTTOM : y(h);
      return `<circle cx="${x(i).toFixed(1)}" cy="${pos.toFixed(1)}" r="${n > 40 ? 2 : 3}" class="${cls}" stroke-width="1"><title>${esc(
        t("checkAt", { status, time }) + detail + code,
      )}</title></circle>`;
    })
    .join("");

  const grid = chartGrid(history);

  return `
    <div class="uptime-chart relative mt-2">
      <svg viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none" class="h-24 w-full" role="img" aria-label="${t("latencyChart")}">
        ${grid.lines}
        ${downBand}
        ${area}
        ${line}
        ${dots}
      </svg>
      ${grid.labels}
    </div>
  `;
}


// ===== RENDER DASHBOARD =====
function renderServices(results) {
  const listElement = document.getElementById("servicesList");
  if (!results.length) {
    listElement.innerHTML = `<div class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">${t("noServices")}</div>`;
    return;
  }
  const barCount = UptimeCore.barCountFor(window.innerWidth);
  const loc = locale();
  listElement.innerHTML = results.map((s) => renderServiceCard(s, barCount, loc)).join("");
}

function renderServiceCard(service, barCount, loc) {
  const isDown = service.status === "down";
  const raw = UptimeCore.tail(service.history || [], barCount);
  const hidden = Math.max(0, (service.history || []).length - barCount);
  const summary = UptimeCore.summarize(raw);
  const chart = renderChart(raw, loc);
  const codeLabel = service.statusCode ? ` — HTTP ${esc(service.statusCode)}` : "";
  const timeLabel = esc(new Date(service.lastChecked).toLocaleTimeString(loc));

  return `
    <div class="overflow-hidden rounded-2xl border border-l-4 border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${
      isDown
        ? "border-l-red-500 dark:border-l-red-500"
        : "border-l-emerald-500 dark:border-l-emerald-500"
    }">
      <div class="p-4 sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold sm:text-base">${esc(service.name)}</p>
            <p class="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-400">${esc(service.url)}</p>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>⏱️ ${t("responseTime")}:
                <strong class="font-semibold text-slate-700 dark:text-slate-200">${
                  service.responseTime ? `${esc(service.responseTime)}ms` : t("noResponse")
                }</strong>
              </span>
              ${
                service.statusCode
                  ? `<span>HTTP <strong class="font-semibold text-slate-700 dark:text-slate-200">${esc(service.statusCode)}</strong></span>`
                  : ""
              }
              <span>🕒 ${t("lastCheckLabel")}:
                <strong class="font-semibold text-slate-700 dark:text-slate-200">${timeLabel}</strong>
              </span>
            </div>
            ${
              service.error
                ? `<p class="mt-2 break-words text-xs text-red-600 dark:text-red-400">⚠️ ${esc(service.error)}</p>`
                : ""
            }
          </div>

          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            isDown
              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
          }">
            <span class="size-1.5 rounded-full ${isDown ? "bg-red-500" : "bg-emerald-500"}"></span>
            ${isDown ? t("offline") : t("online")}
          </span>
        </div>

        <!-- Grafik latency: 1 titik = 1 check, tinggi = response time, warna = status -->
        <div class="mt-4">
          <div class="flex items-baseline justify-between gap-2">
            <p class="text-xs text-slate-500 dark:text-slate-400">${t("uptimeLast", { count: summary.total })}</p>
            <p class="text-base font-bold ${uptimeTone(summary.uptimePercent)}">${summary.uptimePercent.toFixed(1)}%</p>
          </div>
          ${chart}
          <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-full border-2 border-emerald-500 bg-transparent"></span>${t("legendUp")}
              <strong class="font-semibold text-slate-700 dark:text-slate-200">${summary.up}/${summary.total}</strong></span>
            <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-full bg-red-500"></span>${t("legendDown")}
              <strong class="font-semibold text-slate-700 dark:text-slate-200">${summary.down}/${summary.total}</strong></span>
            <span>${t("avgResponse")}:
              <strong class="font-semibold text-slate-700 dark:text-slate-200">${summary.avgResponseTime !== null ? `${summary.avgResponseTime}ms` : "—"}</strong></span>
            <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-full border-2 border-indigo-500 bg-transparent"></span>${t("legendAvg")}</span>
            ${hidden > 0 ? `<span class="text-slate-400 dark:text-slate-500">${t("olderChecks", { count: hidden })}</span>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateSummary(results) {
  const total = results.length;
  const up = results.filter((r) => r.status === "up").length;
  const down = results.filter((r) => r.status === "down").length;
  document.getElementById("totalServices").textContent = total;
  document.getElementById("upServices").textContent = up;
  document.getElementById("downServices").textContent = down;
}

function updateFooterTimestamp() {
  const el = document.getElementById("lastUpdate");
  if (!el) return;
  const stamp = lastHistoryAt || lastStatusAt;
  el.textContent = stamp ? new Date(stamp).toLocaleString(locale()) : "-";
}

// ===== HISTORY PAGE =====
async function loadHistoryData() {
  if (historyInFlight) return;
  historyInFlight = true;

  const historyList = document.getElementById("historyList");
  if (!lastHistory.length) {
    historyList.innerHTML = `<div class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">${t("loadingHistory")}</div>`;
  }

  const params = new URLSearchParams();
  const search = document.getElementById("historySearch")?.value.trim();
  const status = document.getElementById("historyStatus")?.value;
  const from = document.getElementById("historyFrom")?.value;
  const to = document.getElementById("historyTo")?.value;

  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  try {
    const response = await fetch(`/api/history?${params.toString()}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || t("fetchFailed"));

    lastHistory = result.data;
    lastHistoryAt = result.timestamp;
    renderHistory(result.data);
    updateFooterTimestamp();
  } catch (error) {
    console.error("Error fetching history:", error);
    if (!lastHistory.length) {
      historyList.innerHTML = `
        <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          ❌ ${t("fetchHistoryFailed")}: ${esc(error.message)}
        </div>
      `;
    }
  } finally {
    historyInFlight = false;
  }
}

function toggleHistoryDetail(id) {
  const el = document.getElementById(`detail-${id}`);
  const icon = document.getElementById(`icon-${id}`);
  if (!el) return;
  const isHidden = el.classList.toggle("hidden");
  if (icon) icon.style.transform = isHidden ? "rotate(0deg)" : "rotate(180deg)";
  const btn = document.querySelector(`[aria-controls="detail-${id}"]`);
  if (btn) btn.setAttribute("aria-expanded", String(!isHidden));
}

function renderHistory(data) {
  const historyList = document.getElementById("historyList");
  if (!data || data.length === 0) {
    historyList.innerHTML = `<div class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">${t("noHistoryData")}</div>`;
    return;
  }

  // Layanan dengan downtime terbanyak tampil di atas; tanpa data history taruh paling bawah
  const downOf = (s) => (s.history || []).filter((h) => h.status === "down").length;
  const sorted = [...data].sort((a, b) => downOf(b) - downOf(a));

  const loc = locale();
  historyList.innerHTML = sorted.map((service, index) => renderHistoryCard(service, index, loc)).join("");
}

function renderHistoryCard(service, index, loc) {
  // history dari API urut ASC (lama -> baru); timeline dibaca dari yang terbaru
  const historyAsc = service.history || [];
  const summary = UptimeCore.summarize(historyAsc);
  const segments = UptimeCore.tail(
    UptimeCore.buildSegments(historyAsc).reverse(),
    UptimeCore.MAX_SEGMENTS,
  );
  const isDown = service.status === "down";

  return `
    <div class="overflow-hidden rounded-2xl border border-l-4 border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${
      isDown ? "border-l-red-500 dark:border-l-red-500" : "border-l-emerald-500 dark:border-l-emerald-500"
    }">
      <div class="p-4 sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <button type="button" onclick="toggleHistoryDetail(${index})" aria-expanded="false" aria-controls="detail-${index}" class="min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <span class="flex items-center gap-2 text-sm font-semibold sm:text-base">
              <span id="icon-${index}" class="inline-block text-[10px] text-slate-400 transition-transform duration-300">&#9660;</span>
              ${esc(service.name)}
            </span>
            <span class="mt-0.5 block break-all text-xs text-slate-500 dark:text-slate-400">${esc(service.url)}</span>
            <span class="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">${t("clickDetail")}</span>
          </button>
          <div class="flex flex-wrap gap-2">
            <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">&#11014; ${summary.up}</span>
            <span class="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-400">&#11015; ${summary.down}</span>
            <span class="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">${summary.uptimePercent.toFixed(1)}%</span>
          </div>
        </div>

        <div id="detail-${index}" class="hidden">
          <div class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p class="text-xs text-slate-500 dark:text-slate-400">${t("uptimeLast", { count: summary.total })}</p>
            ${renderChart(UptimeCore.tail(historyAsc, UptimeCore.MAX_BARS), loc)}
            <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-full border-2 border-emerald-500 bg-transparent"></span>${t("legendUp")}
                <strong class="font-semibold text-slate-700 dark:text-slate-200">${summary.up}/${summary.total}</strong></span>
              <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-full bg-red-500"></span>${t("legendDown")}
                <strong class="font-semibold text-slate-700 dark:text-slate-200">${summary.down}/${summary.total}</strong></span>
              <span>${t("avgResponse")}:
                <strong class="font-semibold text-slate-700 dark:text-slate-200">${summary.avgResponseTime !== null ? `${summary.avgResponseTime}ms` : "—"}</strong></span>
              <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-full border-2 border-indigo-500 bg-transparent"></span>${t("legendAvg")}</span>
            </div>

            <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">${t("detailToggle")}</p>
            ${
              summary.total === 0
                ? `<p class="mt-2 text-xs text-slate-400 dark:text-slate-500">${t("noHistoryData")}</p>`
                : `<div class="relative mt-2 flex flex-col gap-1 border-l border-slate-200 pl-4 dark:border-slate-800">
              ${segments.map((seg) => renderTimelineItem(seg, loc)).join("")}
            </div>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTimelineItem(seg, loc) {
  const up = seg.status === "up";
  const range =
    seg.start !== seg.end
      ? `${new Date(seg.start).toLocaleString(loc)} — ${new Date(seg.end).toLocaleString(loc)}`
      : new Date(seg.start).toLocaleString(loc);

  return `
    <div class="relative py-1.5">
      <span class="absolute top-3 -left-5 size-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
        up ? "bg-emerald-500" : "bg-red-500"
      }"></span>
      <p class="text-xs font-semibold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}">
        ${t(up ? "online" : "offline")}
      </p>
      <p class="break-words text-[11px] text-slate-500 dark:text-slate-400">${esc(range)}</p>
      ${
        seg.count > 1
          ? `<p class="text-[11px] text-slate-400 dark:text-slate-500">${t("consecutiveChecks", { count: seg.count })}</p>`
          : ""
      }
    </div>
  `;
}


// ===== FILTER / PENCARIAN HISTORY =====
// Debounce 350ms: cegah satu request API per ketikan (tiap request juga mengecek semua layanan).
let filterTimer;
function applyHistoryFilters() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadHistoryData, 350);
}

// ===== RESPONSIVE =====
// Resize hanya menggambar ulang dari data yang sudah ada. Tidak memanggil API,
// karena /api/status & /api/history melakukan pengecekan HTTP ke semua layanan.
let resizeTimer;
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const width = window.innerWidth;
    if (width === lastWidth) return;
    lastWidth = width;

    const activePage = document.querySelector(".page:not(.hidden)")?.id;
    if (activePage === "page-dashboard") {
      if (lastStatus.length) renderServices(lastStatus);
    } else if (activePage === "page-history") {
      if (lastHistory.length) renderHistory(lastHistory);
    }
  }, 300);
});

// ===== AUTO REFRESH =====
// Hanya saat tab terlihat, supaya tidak menambah beban cek layanan di background.
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  checkAllServices();
}, 30000);

// Saat tab dibuka kembali dan data sudah basi (>60 detik), ambil yang baru.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const stale = !lastStatusAt || Date.now() - new Date(lastStatusAt).getTime() > 60000;
  if (stale) checkAllServices();
});

// ===== LOAD PERTAMA =====
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(document.documentElement.classList.contains("dark"));
  document.documentElement.lang = currentLang;
  document.title = t("title");
  applyStaticTranslations();
  checkAllServices();
});