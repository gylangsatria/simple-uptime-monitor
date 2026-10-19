// ===== LOGIKA UPTIME (murni, tanpa DOM) =====
// Dipakai oleh app.js di browser dan bisa dites via `node tests/uptime-core.test.js`.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UptimeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_BARS = 200; // batas bar yang digambar di halaman history
  const MAX_SEGMENTS = 60; // batas entri timeline yang digambar

  // Jumlah check yang ditampilkan sesuai lebar layar
  function barCountFor(width) {
    if (width <= 400) return 10;
    if (width <= 600) return 14;
    if (width <= 768) return 18;
    return 24;
  }

  function responseTimes(history) {
    return history.map((h) => h.responseTime).filter((v) => typeof v === "number");
  }

  // Ringkasan uptime satu layanan
  function summarize(history) {
    const total = history.length;
    const up = history.filter((h) => h.status === "up").length;
    const times = responseTimes(history);
    return {
      total,
      up,
      down: total - up,
      uptimePercent: total > 0 ? (up / total) * 100 : 0,
      avgResponseTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    };
  }

  // Skala latency tetap (log). Dipakai untuk tinggi bar DAN posisi titik grafik,
  // sehingga nilai latency yang sama selalu menghasilkan posisi yang sama.
  // Acuan: 50ms -> 8px, 200ms -> 20px, 1000ms -> 34px, >=2000ms -> 38px (dibatasi).
  const BAR_MIN = 8;
  const BAR_MAX = 38;
  const BAR_UNKNOWN = 14; // up tanpa response time

  function barHeight(responseTime, status) {
    if (typeof responseTime !== "number") {
      return status === "down" ? BAR_MAX : BAR_UNKNOWN;
    }
    const h = BAR_MIN + 20 * Math.log10(Math.max(responseTime, 10) / 50);
    return Math.round(Math.min(Math.max(h, BAR_MIN), BAR_MAX));
  }

  // Posisi titik grafik (0..1), dibalik supaya makin kecil latency makin tinggi (y kecil).
  function latencyScale(responseTime) {
    return 1 - (barHeight(responseTime, "up") - BAR_MIN) / (BAR_MAX - BAR_MIN);
  }

  // Gabung check berurutan dengan status sama jadi satu segmen timeline
  function buildSegments(historyAsc) {
    const segments = [];
    for (const item of historyAsc) {
      const last = segments[segments.length - 1];
      if (last && last.status === item.status) {
        last.end = item.timestamp;
        last.count += 1;
      } else {
        segments.push({ status: item.status, start: item.timestamp, end: item.timestamp, count: 1 });
      }
    }
    return segments;
  }

  function tail(list, max) {
    return list.length > max ? list.slice(-max) : list;
  }

  return {
    barCountFor,
    summarize,
    barHeight,
    latencyScale,
    buildSegments,
    responseTimes,
    tail,
    BAR_MIN,
    BAR_MAX,
    BAR_UNKNOWN,
    MAX_BARS,
    MAX_SEGMENTS,
  };
});
