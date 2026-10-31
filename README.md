# Twibbonzr — hasil reverse engineering

Rekonstruksi cara kerja Twibbonzr: buat twibbon (PNG berlubang transparan), share linknya,
dan biarkan siapa pun memasang foto mereka di atasnya.

## Menjalankan

```bash
npm install
npm run setup     # prisma generate + db push + generate 4 template sample + seed
npm run dev       # http://localhost:4173
```

> `npm run setup` menjalankan `scripts/generate-templates.js` yang merender 4 PNG sample
> (termasuk desain **SUPPORT KAMI! / #TwibbonzrDemo** sesuai hasil reverse engineering)
> dan `prisma/seed.js` yang memasukkannya ke database.
> Reset penuh: `npm run db:reset`.

## Aturan yang dipakai

| Aturan | Implementasi |
| --- | --- |
| Twibbon hangus setelah **2 minggu** | `expiresAt = createdAt + 14 hari`; `server/lib/cleanup.js` jalan tiap menit: hapus row **dan** file |
| Maks **50 twibbon** untuk semua orang dalam 2 minggu | dicek di dalam transaksi Prisma saat `POST /api/templates`; lebih dari itu → **HTTP 429** |
| **Foto pengguna tidak masuk database** | composite jalan di `<canvas>` browser; hasil disimpan di `localStorage` (`twb.gallery.v1`, maks 8 foto) |
| Siapa pun boleh buat & share | tanpa login; setiap twibbon punya share link `/t/:slug` |

Yang di-upload ke server **hanya PNG template** (disimpan di `data/uploads/`, metadata di SQLite).
Foto orang-orang yang memakai twibbon tidak pernah dikirim ke server.

## Struktur

```
prisma/schema.prisma      model Twibbon (SQLite via Prisma)
server/index.js           Express: API + halaman
server/lib/config.js      LIMIT=50, WINDOW=14 hari, path storage
server/lib/quota.js       perhitungan kuota global
server/lib/cleanup.js     auto-delete twibbon kedaluwarsa
scripts/generate-templates.js   render PNG sample (napi-rs/canvas)
public/                   HTML + CSS + JS (vanilla, tanpa build step)
  js/app.js               API client, engine composite, galeri localStorage
  js/home.js|create.js|twibbon.js|gallery.js
data/uploads/             PNG template dari user (gitignored)
```

## API

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/templates` | daftar twibbon aktif + `quota` global |
| GET | `/api/templates/:slug` | metadata 1 twibbon (404 kalau sudah hangus) |
| POST | `/api/templates` | buat twibbon `{title, author, description, image(dataURL PNG)}` → 201 / 400 / 413 / **429** |
| GET | `/uploads/:file` | PNG template, CORS dibuka untuk `<canvas>` |

## Mekanisme compositing (inti reverse engineering)

1. Template = PNG dengan alpha channel — bagian transparan adalah lubang untuk foto.
2. Frontend fetch `GET /api/templates/:slug` lalu load PNG.
3. Foto dibaca `FileReader` → `Image` (tidak dikirim ke server).
4. Canvas: `drawImage(foto)` dulu sebagai background, baru `drawImage(twibbon)` di atasnya.
5. `canvas.toDataURL('image/png')` → download; atau disimpan ke localStorage (Galeri Saya).
