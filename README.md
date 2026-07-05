# Simple Uptime Monitor

A simple uptime monitor built with Node.js and Express.  
Monitor ketersediaan layanan HTTP/S secara real-time dengan tampilan dashboard dan riwayat downtime.

## Fitur

- **Monitor Multi-layanan** — Pantau beberapa layanan HTTP/S sekaligus.
- **Dashboard Real-time** — Status online/offline, response time, dan kode HTTP.
- **Bar Chart History** — Grafik history 24 check terakhir (responsive: menyesuaikan jumlah bar di mobile).
- **History Down** — Halaman detail riwayat lengkap kapan layanan down dan up, lengkap dengan timeline dan persentase uptime.
- **Bilingual (ID/EN)** — Dukungan Bahasa Indonesia dan English, bisa diganti kapan saja.
- **Responsive Design** — Tampilan optimal di desktop, tablet, dan mobile.
- **Auto Refresh** — Pengecekan otomatis setiap 30 detik.
- **Docker Support** — Mudah dijalankan dengan Docker Compose.

## Struktur Proyek

```
├── server.js              # Backend Express — API cek status & history
├── package.json           # Dependencies Node.js
├── Dockerfile             # Docker image (Node.js 18 Alpine)
├── docker-compose.yml     # Docker Compose service
├── README.md              # Dokumentasi ini
└── public/
    ├── index.html         # Halaman utama dengan navigasi & halaman history
    ├── app.js             # Frontend JS — render, i18n, auto-refresh
    └── style.css          # Styling responsif
```

## API Endpoints

| Endpoint       | Method | Deskripsi                                                       |
| -------------- | ------ | --------------------------------------------------------------- |
| `/api/status`  | GET    | Cek status semua layanan (24 history terakhir untuk bar chart)  |
| `/api/history` | GET    | Cek status & kembalikan history lengkap (100 entri per layanan) |

## Cara Menjalankan

### Prasyarat

- [Node.js](https://nodejs.org/) v18+ (tanpa Docker)
- Atau [Docker](https://docker.com) + [Docker Compose](https://docs.docker.com/compose/)

### Jalankan via Node.js (langsung)

```bash
npm install
npm start
```

Akses di `http://localhost:5090`.

### Jalankan via Docker Compose

```bash
docker compose build --no-cache
docker compose up -d
```

Akses di `http://localhost:5080` (port host sudah diubah).

### Menghentikan Container

```bash
docker compose down
```

## Konfigurasi Layanan

Edit daftar layanan yang dipantau di `server.js` pada variabel `services`:

```js
const services = [
  { name: "Google", url: "https://google.com" },
  { name: "WinPoin", url: "https://winpoin.com" },
  { name: "Personal Blog", url: "https://gylang.my.id" },
];
```

## Variabel Lingkungan

| Variabel   | Default      | Deskripsi              |
| ---------- | ------------ | ---------------------- |
| `PORT`     | `5090`       | Port internal aplikasi |
| `NODE_ENV` | `production` | Environment mode       |

## Jaringan Docker

File `docker-compose.yml` menggunakan network eksternal `cloudflare-tunnel-vps`.  
Jika tidak menggunakannya, hapus bagian `networks` atau ganti dengan network internal:

```yaml
services:
  uptime-monitor:
    build: .
    container_name: simple-uptime-monitor
    restart: always
    ports:
      - "5080:5090"
    environment:
      - NODE_ENV=production
      - PORT=5090
```

## Catatan Teknis

- **Penyimpanan History**: History status disimpan di memori (RAM) selama container aktif. Data akan hilang jika container di-restart.
- **Auto Refresh**: Frontend melakukan pengecekan ulang setiap 30 detik.
- **Responsive Bar**: Jumlah bar history menyesuaikan lebar layar — 8 bar (≤400px), 12 bar (≤600px), 16 bar (≤768px), 24 bar (>768px).
- **i18n**: Bahasa disimpan di `localStorage`. Untuk mengganti bahasa, klik tombol ID/EN di pojok kanan atas.
