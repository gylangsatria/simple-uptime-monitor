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
    statusHistory: "Status history ({count} check terakhir)",
    online: "Online",
    offline: "Offline",
    onlineBadge: "{check} Online",
    offlineBadge: "{cross} Offline",
    loadingHistory: "\u{1F50D} Memuat riwayat...",
    fetchHistoryFailed: "Gagal memuat riwayat",
    noHistoryData: "Tidak ada data riwayat",
    na: "N/A",
    consecutiveChecks: "{count} check berturut-turut",
    locale: "id-ID",
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
    statusHistory: "Status history (last {count} checks)",
    online: "Online",
    offline: "Offline",
    onlineBadge: "{check} Online",
    offlineBadge: "{cross} Offline",
    loadingHistory: "\u{1F50D} Loading history...",
    fetchHistoryFailed: "Failed to load history",
    noHistoryData: "No history data available",
    na: "N/A",
    consecutiveChecks: "{count} consecutive checks",
    locale: "en-US",
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
  document.documentElement.lang = lang === "en" ? "en" : "id";
  applyStaticTranslations();
  // Re-render halaman yang aktif
  const activePage = document.querySelector(".page.active");
  if (activePage) {
    const id = activePage.id.replace("page-", "");
    if (id === "dashboard") checkAllServices();
    else if (id === "history") loadHistoryData();
  }
}

function toggleLanguage() {
  setLanguage(currentLang === "id" ? "en" : "id");
}

// Terjemahkan elemen HTML statis yang punya data-i18n
function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  // Update tombol toggle
  const toggleBtn = document.getElementById("langToggle");
  if (toggleBtn) toggleBtn.textContent = currentLang === "id" ? "EN" : "ID";
}

// ===== NAVIGASI =====
function showPage(pageName) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  document.getElementById(`page-${pageName}`).classList.add("active");
  document
    .querySelector(`.nav-item[data-page="${pageName}"]`)
    .classList.add("active");

  if (pageName === "history") {
    loadHistoryData();
  }
}

// ===== FUNGSI CEK STATUS VIA API =====
async function checkAllServices() {
  const listElement = document.getElementById("servicesList");
  listElement.innerHTML = `<div class="loading">${t("checkingServices")}</div>`;

  try {
    const response = await fetch("/api/status");
    const result = await response.json();

    if (result.success) {
      renderServices(result.data);
      updateSummary(result.data);
      updateFooterTimestamp(result.timestamp);
    } else {
      throw new Error(result.error || t("fetchFailed"));
    }
  } catch (error) {
    console.error("Error fetching status:", error);
    listElement.innerHTML = `
            <div class="loading" style="color: #ef4444;">
                ❌ ${t("fetchFailed")}: ${error.message}
                <br><br>
                <button onclick="checkAllServices()" style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    ${t("tryAgain")}
                </button>
            </div>
        `;
  }
}

// ===== HITUNG JUMLAH BAR SESUAI LEBAR LAYAR =====
function getBarCount() {
  const width = window.innerWidth;
  if (width <= 400) return 8;
  if (width <= 600) return 12;
  if (width <= 768) return 16;
  return 24;
}

// ===== RENDER HASIL =====
function renderServices(results) {
  const listElement = document.getElementById("servicesList");

  if (results.length === 0) {
    listElement.innerHTML = `<div class="loading">${t("noServices")}</div>`;
    return;
  }

  const barCount = getBarCount();

  listElement.innerHTML = results
    .map((service) => {
      const history = service.history.slice(-barCount);
      return `
        <div class="service-card ${service.status === "down" ? "down" : ""}">
            <div class="service-info">
                <div class="service-name">${service.name}</div>
                <div class="service-url">${service.url}</div>
                ${service.responseTime ? `<div style="color:#666;font-size:0.8em;">⏱️ ${service.responseTime}ms</div>` : ""}
                ${service.statusCode ? `<div style="color:#666;font-size:0.8em;">HTTP ${service.statusCode}</div>` : ""}
                ${service.error ? `<div class="error-msg">⚠️ ${service.error}</div>` : ""}
                <div class="history-container">
                    <div class="history-title">${t("statusHistory", { count: barCount })}</div>
                    <div class="history-chart" style="grid-template-columns: repeat(${history.length}, 1fr);">
                        ${history
                          .map(
                            (point) => `
                            <div class="history-bar ${point.status}">
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                    <div class="history-legend">
                        <span><span class="history-dot up"></span>${t("online")}</span>
                        <span><span class="history-dot down"></span>${t("offline")}</span>
                    </div>
                </div>
            </div>
            <div class="service-status">
                <span class="status-badge ${service.status === "down" ? "down" : ""}">
                    ${service.status === "up" ? t("onlineBadge", { check: "✅" }) : t("offlineBadge", { cross: "❌" })}
                </span>
                <span class="last-check">${new Date(service.lastChecked).toLocaleTimeString(locale())}</span>
            </div>
        </div>
      `;
    })
    .join("");
}

function updateSummary(results) {
  const total = results.length;
  const up = results.filter((r) => r.status === "up").length;
  const down = results.filter((r) => r.status === "down").length;

  document.getElementById("totalServices").textContent = total;
  document.getElementById("upServices").textContent = up;
  document.getElementById("downServices").textContent = down;
}

function updateFooterTimestamp(timestamp) {
  document.getElementById("lastUpdate").textContent = new Date(
    timestamp,
  ).toLocaleString(locale());
}

// ===== HISTORY DOWN =====
async function loadHistoryData() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = `<div class="loading">${t("loadingHistory")}</div>`;

  try {
    const response = await fetch("/api/history");
    const result = await response.json();

    if (result.success) {
      renderHistory(result.data);
      updateFooterTimestamp(result.timestamp);
    } else {
      throw new Error(result.error || t("fetchFailed"));
    }
  } catch (error) {
    console.error("Error fetching history:", error);
    historyList.innerHTML = `
      <div class="loading" style="color: #ef4444;">
        ❌ ${t("fetchHistoryFailed")}: ${error.message}
        <br><br>
        <button onclick="loadHistoryData()" style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          ${t("tryAgain")}
        </button>
      </div>
    `;
  }
}

function renderHistory(data) {
  const historyList = document.getElementById("historyList");

  if (!data || data.length === 0) {
    historyList.innerHTML = `<div class="loading">${t("noHistoryData")}</div>`;
    return;
  }

  // Urutkan: service dengan history down terbanyak di atas
  const sorted = [...data].sort((a, b) => {
    const downA = a.history.filter((h) => h.status === "down").length;
    const downB = b.history.filter((h) => h.status === "down").length;
    return downB - downA;
  });

  const loc = locale();

  historyList.innerHTML = sorted
    .map((service) => {
      const history = [...service.history].reverse();
      const downCount = history.filter((h) => h.status === "down").length;
      const upCount = history.filter((h) => h.status === "up").length;
      const totalCount = history.length;
      const uptimePercent =
        totalCount > 0 ? ((upCount / totalCount) * 100).toFixed(1) : t("na");

      // Kelompokkan history menjadi segmen up/down berurutan
      const segments = [];
      for (let i = 0; i < history.length; i++) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.status === history[i].status) {
          lastSegment.end = history[i].timestamp;
          lastSegment.count++;
        } else {
          segments.push({
            status: history[i].status,
            start: history[i].timestamp,
            end: history[i].timestamp,
            count: 1,
          });
        }
      }

      return `
        <div class="history-service-card ${service.status === "down" ? "down" : ""}">
          <div class="history-service-header">
            <div class="history-service-info">
              <div class="history-service-name">${service.name}</div>
              <div class="history-service-url">${service.url}</div>
            </div>
            <div class="history-service-stats">
              <span class="stat-item stat-up">⬆ ${upCount}</span>
              <span class="stat-item stat-down">⬇ ${downCount}</span>
              <span class="stat-item stat-uptime">📈 ${uptimePercent}%</span>
            </div>
          </div>

          <div class="history-mini-chart">
            ${history
              .map(
                (h) =>
                  `<div class="mini-bar ${h.status}" title="${new Date(h.timestamp).toLocaleString(loc)} - ${h.status === "up" ? t("online") : t("offline")}"></div>`,
              )
              .join("")}
          </div>

          <div class="history-timeline">
            ${segments
              .map(
                (seg) => `
              <div class="timeline-item ${seg.status}">
                <div class="timeline-dot ${seg.status}"></div>
                <div class="timeline-content">
                  <div class="timeline-status">
                    ${seg.status === "up" ? t("onlineBadge", { check: "✅" }) : t("offlineBadge", { cross: "❌" })}
                  </div>
                  <div class="timeline-time">
                    ${new Date(seg.start).toLocaleString(loc)}
                    ${seg.start !== seg.end ? ` — ${new Date(seg.end).toLocaleString(loc)}` : ""}
                  </div>
                  ${seg.count > 1 ? `<div class="timeline-duration">${t("consecutiveChecks", { count: seg.count })}</div>` : ""}
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

// ===== RESPONSIVE: Re-render saat resize =====
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (
      document.getElementById("page-dashboard").classList.contains("active")
    ) {
      checkAllServices();
    }
  }, 500);
});

// ===== AUTO REFRESH =====
setInterval(checkAllServices, 30000);

// ===== LOAD PERTAMA =====
document.addEventListener("DOMContentLoaded", () => {
  applyStaticTranslations();
  checkAllServices();
});
