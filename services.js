// ===== PARSER DAFTAR LAYANAN =====
// Dibaca dari env SERVICES supaya daftar layanan tidak di-hardcode di server.js.
// Format: "Nama|https://url, Nama Lain|https://url2"
// Entri tanpa "|" atau dengan URL tidak valid diabaikan.
function parseServices(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const at = entry.lastIndexOf("|");
      if (at < 1) return [];
      const name = entry.slice(0, at).trim();
      let url = entry.slice(at + 1).trim();
      if (!name || !url) return [];
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      try {
        new URL(url);
      } catch {
        return [];
      }
      return [{ name, url }];
    });
}

module.exports = { parseServices };
