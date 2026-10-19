// Self-check: node tests/services.test.js
const assert = require("assert");
const { parseServices } = require("../services");

// format "Nama|URL", dipisah koma
assert.deepStrictEqual(
  parseServices("Google|https://google.com, WinPoin|https://winpoin.com"),
  [
    { name: "Google", url: "https://google.com" },
    { name: "WinPoin", url: "https://winpoin.com" },
  ],
);

// skema http:// tanpa prefix ditambahkan otomatis
assert.deepStrictEqual(parseServices("Blog|blog.example.com"), [
  { name: "Blog", url: "https://blog.example.com" },
]);

// spasi berlebih tetap rapi; nama boleh mengandung tanda hubung
assert.deepStrictEqual(parseServices("  My Bike - Motor  | https://a.example.com/x?a=1&b=2  "), [
  { name: "My Bike - Motor", url: "https://a.example.com/x?a=1&b=2" },
]);

// entri rusak diabaikan, entri valid tetap lolos
assert.deepStrictEqual(parseServices("tanpa-pemisah, Ok|https://ok.example.com, ,| , X|bukan url"), [
  { name: "Ok", url: "https://ok.example.com" },
]);

// nilai kosong / tidak ada
assert.deepStrictEqual(parseServices(""), []);
assert.deepStrictEqual(parseServices(undefined), []);
assert.deepStrictEqual(parseServices(","), []);

console.log("services: semua check lolos");
