// Self-check: node tests/uptime-core.test.js
const assert = require("assert");
const core = require("../public/uptime-core.js");

const at = (min) => `2026-01-01T00:${String(min).padStart(2, "0")}:00Z`;
const check = (status, responseTime, min, statusCode = 200) => ({
  status,
  responseTime,
  statusCode,
  timestamp: at(min),
});

// --- ringkasan ---
const summary = core.summarize([
  check("up", 100, 0),
  check("up", 300, 1),
  check("down", null, 2, 0),
  check("up", 200, 3),
]);
assert.deepStrictEqual(summary, {
  total: 4,
  up: 3,
  down: 1,
  uptimePercent: 75,
  avgResponseTime: 200,
});
assert.deepStrictEqual(core.summarize([]), {
  total: 0,
  up: 0,
  down: 0,
  uptimePercent: 0,
  avgResponseTime: null,
});

// --- posisi titik grafik: turunan skala latency tetap (log) ---
assert.deepStrictEqual(
  [50, 200, 1000, 2000].map((t) => Math.round(core.latencyScale(t) * 1000) / 1000),
  [1, 0.6, 0.133, 0],
);
assert.strictEqual(core.latencyScale(50), 1, "latency terkecil ada di puncak grafik");
assert.strictEqual(core.latencyScale(999999), 0, "latency terbesar ada di dasar grafik");
assert.ok(core.latencyScale(120) > core.latencyScale(900), "makin lambat makin rendah");

// --- tinggi bar: skala latency tetap (log), stabil & sebanding antar layanan ---
const heights = [50, 200, 1000, 2000].map((t) => core.barHeight(t, "up"));
assert.deepStrictEqual(heights, [8, 20, 34, 38]);
// nilai sama -> tinggi sama (tidak lagi dinormalisasi per layanan)
assert.strictEqual(core.barHeight(250, "up"), core.barHeight(250, "up"));
// dibatasi di rentang BAR_MIN..BAR_MAX walau latency ekstrem
assert.strictEqual(core.barHeight(1, "up"), core.BAR_MIN);
assert.strictEqual(core.barHeight(999999, "up"), core.BAR_MAX);
assert.strictEqual(core.barHeight(null, "up"), core.BAR_UNKNOWN);
assert.strictEqual(core.barHeight(null, "down"), core.BAR_MAX);
// latency lebih lambat tidak pernah lebih pendek
assert.ok(core.barHeight(900, "up") > core.barHeight(120, "up"));

// --- segmen timeline ter-gabung, kronologis ---
const segments = core.buildSegments([
  check("up", 100, 0),
  check("up", 100, 1),
  check("down", null, 2),
  check("up", 100, 3),
]);
assert.deepStrictEqual(segments, [
  { status: "up", start: at(0), end: at(1), count: 2 },
  { status: "down", start: at(2), end: at(2), count: 1 },
  { status: "up", start: at(3), end: at(3), count: 1 },
]);

// --- bar count per breakpoint ---
assert.deepStrictEqual([320, 500, 700, 1200].map(core.barCountFor), [10, 14, 18, 24]);

// --- tail membatasi jumlah tanpa mengubah urutan ---
assert.deepStrictEqual(core.tail([1, 2, 3, 4, 5], 2), [4, 5]);
assert.deepStrictEqual(core.tail([1, 2], 5), [1, 2]);

console.log("uptime-core: semua check lolos");
