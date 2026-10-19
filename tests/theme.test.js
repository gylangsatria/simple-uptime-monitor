// Self-check tema: node tests/theme.test.js
// Regresi: tombol tema harus bekerja walau app.js belum selesai dimuat.
// Skrip diuji apa adanya dari <head> index.html, tanpa app.js.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const themeScript = scripts.find((s) => s.includes("uptime-theme"));
assert.ok(themeScript, "skrip tema tidak ditemukan di index.html");

function boot({ saved = null, systemDark = false } = {}) {
  const classes = new Set();
  const btn = {
    attrs: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
  };
  const store = new Map();
  if (saved) store.set("uptime-theme", saved);

  let domReady = null;
  const window = { matchMedia: () => ({ matches: systemDark }) };
  const sandbox = {
    window,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    },
    document: {
      documentElement: {
        classList: {
          contains: (c) => classes.has(c),
          toggle: (c, force) => {
            const on = force === undefined ? !classes.has(c) : force;
            on ? classes.add(c) : classes.delete(c);
            return on;
          },
        },
      },
      getElementById: (id) => (id === "themeToggle" ? btn : null),
      addEventListener: (ev, fn) => {
        if (ev === "DOMContentLoaded") domReady = fn;
      },
    },
  };
  window.matchMedia = sandbox.window.matchMedia;
  vm.createContext(sandbox);
  vm.runInContext(themeScript, sandbox);
  if (domReady) domReady();
  return { sandbox, classes, store, btn };
}

// Default terang
{
  const t = boot();
  assert.strictEqual(t.classes.has("dark"), false, "default harus light");
  assert.strictEqual(typeof t.sandbox.window.toggleTheme, "function", "window.toggleTheme tidak didefinisikan");
  assert.strictEqual(t.btn.attrs["aria-pressed"], "false");
}

// Toggle dua kali -> dark lalu light, tersimpan
{
  const t = boot();
  t.sandbox.window.toggleTheme();
  assert.strictEqual(t.classes.has("dark"), true, "klik pertama harus jadi dark");
  assert.strictEqual(t.store.get("uptime-theme"), "dark");
  assert.strictEqual(t.btn.attrs["aria-pressed"], "true");
  t.sandbox.window.toggleTheme();
  assert.strictEqual(t.classes.has("dark"), false, "klik kedua harus balik terang");
  assert.strictEqual(t.store.get("uptime-theme"), "light");
  assert.strictEqual(t.btn.attrs["aria-pressed"], "false");
}

// Preferensi sistem dipakai kalau belum pernah dipilih
{
  const t = boot({ systemDark: true });
  assert.strictEqual(t.classes.has("dark"), true, "harus ikut prefers-color-scheme: dark");
  assert.strictEqual(t.store.has("uptime-theme"), false, "preferensi sistem tidak boleh ditulis ke storage");
}

// Pilihan manual menang atas preferensi sistem
{
  const t = boot({ saved: "light", systemDark: true });
  assert.strictEqual(t.classes.has("dark"), false, "pilihan tersimpan harus menang");
  const t2 = boot({ saved: "dark", systemDark: false });
  assert.strictEqual(t2.classes.has("dark"), true);
}

console.log("theme: semua check lolos");
