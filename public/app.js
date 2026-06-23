// ===== NAVIGASI =====
function showPage(pageName) {
  // Sembunyikan semua halaman
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  // Nonaktifkan semua nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Aktifkan halaman dan nav yang dipilih
  document.getElementById(`page-${pageName}`).classList.add("active");
  document
    .querySelector(`.nav-item[data-page="${pageName}"]`)
    .classList.add("active");

  // Load data jika halaman history
  if (pageName === "history") {
    loadHistoryData();
  }
}

// ===== FUNGSI CEK STATUS VIA API =====
async function checkAllServices() {
  const listElement = document.getElementById("servicesList");
  listElement.innerHTML = '<div class="loading">🔍 Mengecek layanan...</div>';

  try {
    const response = await fetch("/api/status");
    const result = await response.json();

    if (result.success) {
      renderServices(result.data);
      updateSummary(result.data);
      updateFooterTimestamp(result.timestamp);
    } else {
      throw new Error(result.error || "Gagal memuat data");
    }
  } catch (error) {
    console.error("Error fetching status:", error);
    listElement.innerHTML = `
            <div class="loading" style="color: #ef4444;">
                ❌ Gagal memuat data: ${error.message}
                <br><br>
                <button onclick="checkAllServices()" style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Coba Lagi
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
    listElement.innerHTML =
      '<div class="loading">Tidak ada layanan yang dikonfigurasi</div>';
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
                    <div class="history-title">Status history (${barCount} check terakhir)</div>
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
                        <span><span class="history-dot up"></span>Online</span>
                        <span><span class="history-dot down"></span>Offline</span>
                    </div>
                </div>
            </div>
            <div class="service-status">
                <span class="status-badge ${service.status === "down" ? "down" : ""}">
                    ${service.status === "up" ? "✅ Online" : "❌ Offline"}
                </span>
                <span class="last-check">${new Date(service.lastChecked).toLocaleTimeString("id-ID")}</span>
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
  ).toLocaleString("id-ID");
}

// ===== HISTORY DOWN =====
async function loadHistoryData() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = '<div class="loading">🔍 Memuat riwayat...</div>';

  try {
    const response = await fetch("/api/history");
    const result = await response.json();

    if (result.success) {
      renderHistory(result.data);
      updateFooterTimestamp(result.timestamp);
    } else {
      throw new Error(result.error || "Gagal memuat data");
    }
  } catch (error) {
    console.error("Error fetching history:", error);
    historyList.innerHTML = `
      <div class="loading" style="color: #ef4444;">
        ❌ Gagal memuat riwayat: ${error.message}
        <br><br>
        <button onclick="loadHistoryData()" style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Coba Lagi
        </button>
      </div>
    `;
  }
}

function renderHistory(data) {
  const historyList = document.getElementById("historyList");

  if (!data || data.length === 0) {
    historyList.innerHTML = '<div class="loading">Tidak ada data riwayat</div>';
    return;
  }

  // Urutkan: service dengan history down terbanyak di atas
  const sorted = [...data].sort((a, b) => {
    const downA = a.history.filter((h) => h.status === "down").length;
    const downB = b.history.filter((h) => h.status === "down").length;
    return downB - downA;
  });

  historyList.innerHTML = sorted
    .map((service) => {
      const history = [...service.history].reverse(); // terbaru di atas
      const downCount = history.filter((h) => h.status === "down").length;
      const upCount = history.filter((h) => h.status === "up").length;
      const totalCount = history.length;
      const uptimePercent =
        totalCount > 0 ? ((upCount / totalCount) * 100).toFixed(1) : "N/A";

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

          <!-- Ringkasan bar -->
          <div class="history-mini-chart">
            ${history
              .map(
                (h) =>
                  `<div class="mini-bar ${h.status}" title="${new Date(h.timestamp).toLocaleString("id-ID")} - ${h.status === "up" ? "Online" : "Offline"}"></div>`,
              )
              .join("")}
          </div>

          <!-- Timeline segmen -->
          <div class="history-timeline">
            ${segments
              .map(
                (seg) => `
              <div class="timeline-item ${seg.status}">
                <div class="timeline-dot ${seg.status}"></div>
                <div class="timeline-content">
                  <div class="timeline-status">
                    ${seg.status === "up" ? "✅ Online" : "❌ Offline"}
                  </div>
                  <div class="timeline-time">
                    ${new Date(seg.start).toLocaleString("id-ID")}
                    ${seg.start !== seg.end ? ` — ${new Date(seg.end).toLocaleString("id-ID")}` : ""}
                  </div>
                  ${seg.count > 1 ? `<div class="timeline-duration">${seg.count} check berturut-turut</div>` : ""}
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
// Refresh setiap 30 detik
setInterval(checkAllServices, 30000);

// ===== LOAD PERTAMA =====
document.addEventListener("DOMContentLoaded", checkAllServices);
