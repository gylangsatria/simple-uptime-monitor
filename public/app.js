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
      document.getElementById("lastUpdate").textContent = new Date(
        result.timestamp,
      ).toLocaleString("id-ID");
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

// ===== RENDER HASIL =====
function renderServices(results) {
  const listElement = document.getElementById("servicesList");

  if (results.length === 0) {
    listElement.innerHTML =
      '<div class="loading">Tidak ada layanan yang dikonfigurasi</div>';
    return;
  }

  listElement.innerHTML = results
    .map(
      (service) => `
        <div class="service-card ${service.status === "down" ? "down" : ""}">
            <div class="service-info">
                <div class="service-name">${service.name}</div>
                <div class="service-url">${service.url}</div>
                ${service.responseTime ? `<div style="color:#666;font-size:0.8em;">⏱️ ${service.responseTime}ms</div>` : ""}
                ${service.statusCode ? `<div style="color:#666;font-size:0.8em;">HTTP ${service.statusCode}</div>` : ""}
                ${service.error ? `<div class="error-msg">⚠️ ${service.error}</div>` : ""}
                <div class="history-container">
                    <div class="history-title">Status history (24 check terakhir)</div>
                    <div class="history-chart">
                        ${service.history
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
    `,
    )
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

// ===== AUTO REFRESH =====
// Refresh setiap 30 detik
setInterval(checkAllServices, 30000);

// ===== LOAD PERTAMA =====
document.addEventListener("DOMContentLoaded", checkAllServices);
