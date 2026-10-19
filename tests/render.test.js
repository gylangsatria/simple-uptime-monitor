// Self-check render: node tests/render.test.js
// Menjalankan app.js di sandbox minimal (tanpa browser) untuk memverifikasi output HTML.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const file = path.join(__dirname, "..", "public", "app.js");

function makeEl() {
  const classes = new Set(["hidden"]);
  return {
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    dataset: {},
    style: {},
    attrs: {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : force;
        on ? classes.add(c) : classes.delete(c);
        return on;
      },
    },
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    addEventListener() {},
  };
}

function boot() {
  const els = new Map();
  const ids = [
    "servicesList",
    "historyList",
    "totalServices",
    "upServices",
    "downServices",
    "lastUpdate",
    "themeToggle",
    "langToggle",
    "historySearch",
    "historyStatus",
    "historyFrom",
    "historyTo",
  ];
  ids.forEach((id) => els.set(id, makeEl()));

  const sandbox = {
    console,
    // app.js memakai setInterval untuk auto refresh; di sandbox di-unref supaya test bisa keluar
    setInterval: (fn, ms) => {
      const id = setInterval(fn, ms);
      if (id.unref) id.unref();
      return id;
    },
    setTimeout,
    clearTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async () => ({ json: async () => ({ success: true, data: [], timestamp: null }) }),
    document: {
      title: "",
      visibilityState: "visible",
      documentElement: makeEl(),
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: (id) => els.get(id) || null,
    },
    window: { addEventListener() {}, innerWidth: 1200 },
    UptimeCore: require("../public/uptime-core.js"),
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);
  return { sandbox, els };
}

const check = (status, responseTime, min, statusCode = 200) => ({
  status,
  responseTime,
  statusCode,
  timestamp: `2026-01-01T00:${String(min).padStart(2, "0")}:00Z`,
});

const service = {
  name: 'API <b>"X"</b>',
  url: "https://example.com/?a=1&b=2",
  status: "down",
  statusCode: 502,
  responseTime: null,
  lastChecked: "2026-01-01T00:10:00Z",
  error: 'timeout <script>alert(1)</script>',
  history: [check("up", 120, 0), check("up", 300, 1), check("down", null, 2, 502)],
};

// --- dashboard ---
{
  const { sandbox, els } = boot();
  sandbox.renderServices([service]);
  const html = els.get("servicesList").innerHTML;
  assert.ok(html.includes("2/3"), "ringkasan up/total salah");
  assert.ok(html.includes("66.7%"), "persentase uptime salah");
  assert.ok(html.includes("210ms"), "rata-rata response time salah");
  // grafik latency (SVG) menggantikan bar
  assert.ok(html.includes("uptime-chart"), "grafik latency hilang");
  assert.ok(html.includes("100ms") && html.includes("1s"), "label skala latency hilang");
  assert.ok(html.includes("<polyline"), "garis latency hilang");
  const cys = [...html.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.strictEqual(cys.length, service.history.length, "jumlah titik grafik != jumlah check");
  // down tanpa latency -> titik di dasar grafik
  assert.strictEqual(cys[cys.length - 1], 92, "titik down tanpa latency harus di dasar grafik");
  // warna titik = status
  assert.ok(/fill-emerald-500/.test(html) && /fill-red-500/.test(html), "warna titik grafik salah");
  // nilai latency sama -> posisi y sama, walau di kumpulan data berbeda
  {
    const { sandbox: s2, els: e2 } = boot();
    s2.renderServices([{ ...service, history: [check("up", 120, 0)] }]);
    const other = [...e2.get("servicesList").innerHTML.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.deepStrictEqual(other, [cys[0]], "posisi titik berubah antar layanan untuk latency sama");
  }
  assert.ok(html.includes("<span class=\"inline-flex"), "badge status hilang");
  // escaping
  assert.ok(!html.includes("<script>"), "XSS: tag script tidak di-escape");
  assert.ok(html.includes("&lt;b&gt;") && html.includes("&amp;b=2"), "nama/url tidak di-escape");
  // tidak ada layanan
  sandbox.renderServices([]);
  assert.ok(els.get("servicesList").innerHTML.includes("py-10"), "pesan kosong hilang");
  // ringkasan atas
  sandbox.updateSummary([service, { status: "up" }]);
  assert.strictEqual(els.get("totalServices").textContent, 2);
  assert.strictEqual(els.get("upServices").textContent, 1);
  assert.strictEqual(els.get("downServices").textContent, 1);
}

// --- history ---
{
  const { sandbox, els } = boot();
  const filteredEmpty = { ...service, name: "Kosong", history: [] };
  sandbox.renderHistory([service, filteredEmpty]);
  const html = els.get("historyList").innerHTML;
  assert.ok(html.includes("Kosong"), "kartu layanan tanpa history hilang");
  assert.ok(html.includes("2/3"), "ringkasan history salah");
  // timeline terbaru dulu: setelah penanda detail, dot pertama harus milik segmen "down"
  const marker = html.indexOf(sandbox.t("detailToggle"));
  assert.ok(marker > -1, "judul detail timeline hilang");
  const idxDown = html.indexOf("bg-red-500", marker);
  const idxUp = html.indexOf("bg-emerald-500", marker);
  assert.ok(idxDown > -1 && idxUp > -1 && idxDown < idxUp, "timeline harus urut terbaru -> terlama");
  assert.ok(!html.includes("<script>"), "XSS di history tidak di-escape");
  // data kosong
  sandbox.renderHistory([]);
  assert.ok(els.get("historyList").innerHTML.includes("py-10"), "pesan kosong history hilang");
}

console.log("render: semua check lolos");
