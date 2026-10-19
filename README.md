# Simple Uptime Monitor

A simple uptime monitor built with Node.js and Express.  
Monitor ketersediaan layanan HTTP/S secara real-time dengan tampilan dashboard dan riwayat downtime.

## Fitur

- **Monitor Multi-layanan** — Pantau beberapa layanan HTTP/S sekaligus.
- **Dashboard Real-time** — Status online/offline, response time, kode HTTP, dan waktu check terakhir.
- **Grafik Latency** — Grafik area/garis per layanan: 1 titik = 1 check, sumbu Y = response time (skala log tetap), titik hijau/merah = status, kolom merah transparan = downtime, garis putus-putus = gridline 100ms & 1s. Tinggi grafik sebanding antar layanan dan antar waktu karena skalanya tetap, bukan normalisasi per layanan. Hover titik menampilkan waktu + latency + kode HTTP.
- **History Down** — Halaman detail riwayat lengkap kapan layanan down dan up, lengkap dengan timeline dan persentase uptime.
- **Dark & Light Mode** — Mengikuti preferensi OS, bisa diganti manual lewat tombol di header, pilihan disimpan di `localStorage`.
- **Bilingual (ID/EN)** — Dukungan Bahasa Indonesia dan English, bisa diganti kapan saja.
- **Responsive Design** — Tampilan optimal di desktop, tablet, dan mobile (Tailwind CSS v4).
- **Auto Refresh** — Pengecekan otomatis setiap 30 detik, hanya saat tab aktif, plus refresh saat tab dibuka kembali jika data sudah basi.
- **Docker Support** — Mudah dijalankan dengan Docker Compose.

## Struktur Proyek

```
├── server.js               # Backend Express — API cek status & history
├── services.js             # Parser daftar layanan dari env SERVICES
├── package.json            # Dependencies Node.js + script npm test
├── Dockerfile              # Docker image (Node.js 18 Alpine)
├── docker-compose.yml      # Docker Compose service
├── .env.example            # Contoh konfigurasi (PORT, TZ, SERVICES)
├── README.md               # Dokumentasi ini
├── public/
│   ├── index.html          # Halaman utama (Tailwind v4 via CDN)
│   ├── app.js              # Frontend JS — render grafik, i18n, tema, auto-refresh
│   └── uptime-core.js      # Logika uptime murni (dipakai app.js & test)
└── tests/
    ├── services.test.js    # Self-check parser SERVICES
    ├── uptime-core.test.js # Self-check logika uptime
    ├── theme.test.js       # Self-check toggle tema
    └── render.test.js      # Self-check output HTML render
```

## Test

```bash
npm test                      # jalankan semua self-check (services, core, tema, render)
```

## API Endpoints

| Endpoint       | Method | Deskripsi                                                        |
| -------------- | ------ | ---------------------------------------------------------------- |
| `/api/status`  | GET    | Cek status semua layanan (48 check terakhir per layanan)         |
| `/api/history` | GET    | Cek status & kembalikan history (maks 2000 entri per layanan)     |

`/api/history` mendukung query `search`, `status` (`up`/`down`), `from`, dan `to` (format `YYYY-MM-DD`, waktu lokal server).

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

Daftar layanan dibaca dari variabel lingkungan `SERVICES` (file `.env`), jadi tidak perlu mengubah kode:

```bash
cp .env.example .env   # sekali saja
```

Format: `Nama|URL` dipisah koma. Skema `https://` ditambahkan otomatis bila tidak ditulis.

```env
SERVICES=Google|https://google.com, WinPoin|https://winpoin.com, Personal Blog|gylang.my.id
```

Entri tanpa `|` atau dengan URL tidak valid diabaikan, dan peringatan muncul di log bila tidak ada satu pun layanan valid. Setelah mengubah `.env`:

```bash
docker compose up -d   # recreate container agar env terbaca
```

Layanan yang dihapus dari `SERVICES` tetap tampil di halaman **History** (data historisnya tidak dihapus), hanya tidak dicek lagi.

## Variabel Lingkungan

| Variabel   | Default      | Deskripsi                             |
| ---------- | ------------ | ------------------------------------- |
| `SERVICES` | –            | Daftar layanan (`Nama\|URL`, koma)     |
| `PORT`     | `5090`       | Port internal aplikasi                |
| `TZ`       | `Asia/Jakarta` | Zona waktu server                   |
| `NODE_ENV` | `production` | Environment mode                      |
| `DB_PATH`  | `data/uptime.db` | Lokasi file SQLite                |

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
    env_file:
      - .env
```

## Catatan Teknis

- **Penyimpanan History**: Status check disimpan di SQLite (`data/uptime.db`), bukan di memori. Data tetap ada setelah restart.
- **Waktu Check**: Timestamp disimpan sebagai ISO-8601 UTC (`2026-10-19T07:26:51Z`). Database lama dengan format `YYYY-MM-DD HH:MM:SS` dimigrasikan otomatis saat server start, supaya jam di timeline tidak bergeser.
- **Auto Refresh**: Frontend mengecek ulang setiap 30 detik, tetapi hanya saat tab terlihat. Saat tab dibuka kembali dan data sudah lebih dari 60 detik, data langsung diambil ulang.
- **Anti Request Ganda**: Request yang sedang berjalan di-guard (`inFlight`), pencarian history di-debounce 350ms, dan resize tidak memicu pengecekan ulang — hanya render ulang dari data yang sudah ada. Ini penting karena tiap request `/api/status` dan `/api/history` melakukan HTTP check ke semua layanan.
- **Responsive Titik Grafik**: Jumlah check yang dikirim ke dashboard menyesuaikan lebar layar — 10 (≤400px), 14 (≤600px), 18 (≤768px), 24 (>768px). API mengirim 48 check terakhir, jadi jumlah titik bisa berubah tanpa request baru.
- **Batas Render**: Halaman history menggambar maksimum 200 titik grafik dan 60 segmen timeline per layanan (data terlama yang berlebih dihitung di ringkasan, hanya tidak digambar).
- **Konfigurasi Layanan**: Daftar layanan berasal dari env `SERVICES` (`Nama|URL`, dipisah koma) di `.env`, bukan hardcode di `server.js`. Layanan yang dihapus dari `SERVICES` tetap tampil di halaman History (diambil dari database) agar data historis tidak hilang.
- **i18n**: Bahasa disimpan di `localStorage`. Tombol ID/EN mengganti bahasa tanpa memanggil API lagi.
- **Tema**: Tema mengikuti `prefers-color-scheme` saat pertama kali dibuka; setelah itu pilihan tombol tema yang dipakai. Tema ditulis sebelum paint supaya tidak berkedip, dan `window.toggleTheme` didefinisikan di `<head>` sehingga tombol tema tetap bekerja walau `app.js` (di akhir body) belum selesai dimuat.
- **Keamanan**: Nama layanan, URL, dan pesan error di-escape sebelum dimasukkan ke HTML. Kredensial/daftar layanan ada di `.env` yang di-`gitignore`.

