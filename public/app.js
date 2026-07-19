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
    searchPlaceholder: "Cari layanan...",
    filterAll: "Semua",
    filterFrom: "Dari",
    filterTo: "Sampai",
    locale: "id-ID",
    clickDetail: "Klik untuk detail riwayat",
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
    searchPlaceholder: "Search service...",
    filterAll: "All",
    filterFrom: "From",
    filterTo: "To",
    locale: "en-US",
    clickDetail: "Click for history details",
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

// ===== RENDER DASHBOARD =====
function renderServices(results) {
  const listElement = document.getElementById("servicesList");
  if (results.length === 0) {
    listElement.innerHTML = `<div class="loading">${t("noServices")}</div>`;
    return;
  }
  const barCount = getBarCount();

  listElement.innerHTML = results
    .map((service) => {
      const raw = service.history.slice(-barCount);
      const upCount = raw.filter((h) => h.status === "up").length;
      const downCount = raw.filter((h) => h.status === "down").length;
      const totalCount = raw.length;
      const uptimePercent = totalCount > 0 ? ((upCount / totalCount) * 100).toFixed(1) : "0";
      const downPercent = totalCount > 0 ? ((downCount / totalCount) * 100).toFixed(1) : "0";

      return `
        <div class="service-card ${service.status === "down" ? "down" : ""}">
          <div class="service-info">
            <div class="service-name">${service.name}</div>
            <div class="service-url">${service.url}</div>
            ${service.responseTime ? `<div style="color:#666;font-size:0.8em;">⏱️ ${service.responseTime}ms</div>` : ""}
            ${service.statusCode ? `<div style="color:#666;font-size:0.8em;">HTTP ${service.statusCode}</div>` : ""}
            ${service.error ? `<div class="error-msg">⚠️ ${service.error}</div>` : ""}
            <div class="history-container">
              <div class="history-title">${t("statusHistory", { count: barCount })} — ${uptimePercent}% ${t("online")}</div>
              <div class="uptime-progress">
                <div class="uptime-fill up" style="width:${uptimePercent}%"></div>
                <div class="uptime-fill down" style="width:${downPercent}%"></div>
              </div>
              <div class="history-legend">
                <span><span class="history-dot up"></span>${t("online")} <strong>${upCount}/${totalCount}</strong></span>
                <span><span class="history-dot down"></span>${t("offline")} <strong>${downCount}/${totalCount}</strong></span>
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
  const el = document.getElementById("lastUpdate");
  if (el) el.textContent = new Date(timestamp).toLocaleString(locale());
}

// ===== HISTORY PAGE =====
async function loadHistoryData() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = `<div class="loading">${t("loadingHistory")}</div>`;

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
    if (result.success) {
      renderHistory(result.data);
      updateFooterTimestamp(result.timestamp);
    } else {
      throw new Error(result.error || t("fetchFailed"));
    }
  } catch (error) {
    console.error("Error fetching history:", error);
    historyList.innerHTML = `
      <div class="loading" style="color: #ef4444;">❌ ${t("fetchHistoryFailed")}: ${error.message}</div>
    `;
  }
}

function toggleHistoryDetail(id) {
  const el = document.getElementById(`detail-${id}`);
  const icon = document.getElementById(`icon-${id}`);
  if (el) {
    const isHidden = el.style.display === "none" || !el.style.display;
    el.style.display = isHidden ? "block" : "none";
    if (icon) icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
  }
}

function renderHistory(data) {
  const historyList = document.getElementById("historyList");
  if (!data || data.length === 0) {
    historyList.innerHTML = `<div class="loading">${t("noHistoryData")}</div>`;
    return;
  }

  const sorted = [...data].sort((a, b) => {
    const downA = a.history.filter((h) => h.status === "down").length;
    const downB = b.history.filter((h) => h.status === "down").length;
    return downB - downA;
  });

  const loc = locale();

  historyList.innerHTML = sorted
    .map((service, index) => {
      const allHistory = service.history || [];
      const allReversed = [...allHistory].reverse();
      const downCount = allReversed.filter((h) => h.status === "down").length;
      const upCount = allReversed.filter((h) => h.status === "up").length;
      const totalCount = allReversed.length;
      const uptimePercent = totalCount > 0 ? ((upCount / totalCount) * 100).toFixed(1) : "0";
      const downPercent = totalCount > 0 ? ((downCount / totalCount) * 100).toFixed(1) : "0";

      const segments = [];
      for (let i = 0; i < allReversed.length; i++) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.status === allReversed[i].status) {
          lastSegment.end = allReversed[i].timestamp;
          lastSegment.count++;
        } else {
          segments.push({
            status: allReversed[i].status,
            start: allReversed[i].timestamp,
            end: allReversed[i].timestamp,
            count: 1,
          });
        }
      }

      return `
        <div class="history-service-card ${service.status === "down" ? "down" : ""}">
          <div class="history-service-header" onclick="toggleHistoryDetail(${index})" style="cursor:pointer; user-select:none;">
            <div class="history-service-info">
              <div class="history-service-name">
                ${service.name} 
                <span id="icon-${index}" style="display:inline-block; transition:transform 0.3s; font-size:0.8em; margin-left:5px;">▼</span>
              </div>
              <div class="history-service-url">${service.url}</div>
              <div style="font-size:0.75em; color:#888; margin-top:4px;">${t("clickDetail")}</div>
            </div>
            <div class="history-service-stats">
              <span class="stat-item stat-up">⬆ ${upCount}</span>
              <span class="stat-item stat-down">⬇ ${downCount}</span>
              <span class="stat-item stat-uptime">📈 ${uptimePercent}%</span>
            </div>
          </div>

          <div class="uptime-progress" style="margin-top:12px;">
            <div class="uptime-fill up" style="width:${uptimePercent}%"></div>
            <div class="uptime-fill down" style="width:${downPercent}%"></div>
          </div>

          <!-- Bagian Detail yang bisa di-toggle -->
          <div id="detail-${index}" style="display:none; margin-top:15px; border-top:1px solid #eee; padding-top:15px;">
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
        </div>
      `;
    })
    .join("");
}

// ===== FILTER HISTORY =====
function applyHistoryFilters() {
  loadHistoryData();
}

// ===== RESPONSIVE =====
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const activePage = document.querySelector(".page.active");
    if (!activePage) return;
    const id = activePage.id.replace("page-", "");
    if (id === "dashboard") checkAllServices();
    else if (id === "history") loadHistoryData();
  }, 500);
});

// ===== AUTO REFRESH =====
setInterval(checkAllServices, 30000);

// ===== LOAD PERTAMA =====
document.addEventListener("DOMContentLoaded", () => {
  applyStaticTranslations();
  checkAllServices();
});