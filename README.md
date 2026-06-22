# Simple Uptime Monitor

A simple uptime monitor built with Node.js and Express.

## Fitur

- Monitor beberapa layanan HTTP/S.
- Menampilkan status uptime (online/offline) dan response time.
- Menyimpan history status terakhir untuk setiap layanan.
- Menampilkan grafik history status mirip Uptime Kuma.
- Dijalankan menggunakan Docker dan Docker Compose.

## Struktur

- `server.js` - Backend Express yang memeriksa layanan dan menyimpan history status.
- `public/index.html` - Frontend HTML/CSS/JS yang menampilkan status dan grafik history.
- `Dockerfile` - Docker image untuk menjalankan aplikasi.
- `docker-compose.yml` - Docker Compose service untuk container.

## Cara Menjalankan

### Prasyarat

- Docker
- Docker Compose

### Jalankan via Docker Compose

```bash
docker compose build
docker compose up -d
```

Akses aplikasi pada `http://localhost:5090`.

### Menghentikan dan Menghapus Container

```bash
docker compose down
```

## Konfigurasi Layanan

Layanan yang dipantau dikonfigurasi di file `server.js` pada variabel `services`.

Contoh:

```js
const services = [
  { name: 'Google', url: 'https://google.com' },
  { name: 'WinPoin', url: 'https://winpoin.com' }
];
```

## Catatan

- History status disimpan di memori sementara aplikasi berjalan, dan hanya bertahan selama container aktif.
- Setiap pengecekan status otomatis dilakukan di frontend setiap 30 detik.
