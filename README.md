# Twibbonzr — hasil reverse engineering

Rekonstruksi cara kerja Twibbonize: buat twibbon (PNG berlubang transparan), share linknya,
dan biarkan siapa pun memasang foto mereka di atasnya.

- **Backend**: Express 5 + **Prisma 7** (PostgreSQL / Prisma Postgres) + `@prisma/adapter-pg`
- **Frontend**: vanilla HTML/CSS/JS, tanpa build step
- **Storage**: Vercel Blob (di Vercel) atau `data/uploads/` (lokal)
- **Target deploy**: Vercel (function `api/index.js` + static `public/`)

## Menjalankan

```bash
npm install          # otomatis menjalankan `prisma generate`

# isi .env dulu — sekarang WAJIB ada DATABASE_URL (provider sudah postgresql)
#   DATABASE_URL=<direct>        → dipakai CLI (migrate/push/studio)
#   DATABASE_URL_POOLED=<pooled> → dipakai aplikasi saat runtime
cp .env.example .env 2>/dev/null || true   # panduan ada di dalam .env

npm run setup        # generate + db push + render 4 template sample + seed
npm run dev          # http://localhost:4173
```

> Tanpa `DATABASE_URL`, server tetap hidup dan halaman tetap tampil, tapi seluruh `/api/*`
> menjawab **503** dengan pesan cara mengisi env — itu perilaku yang diharapkan, bukan bug.

## Aturan yang dipakai

| Aturan | Implementasi |
| --- | --- |
| Twibbon hangus setelah **2 minggu** | `expiresAt = createdAt + 14 hari`; `server/lib/cleanup.js` jalan tiap menit (lokal) + **Vercel Cron harian** (produksi) |
| Maks **50 twibbon** untuk semua orang dalam 2 minggu | dicek di dalam transaksi Prisma saat `POST /api/templates`; lebih dari itu → **HTTP 429** + `Retry-After` |
| **Foto pengguna tidak masuk database** | composite jalan di `<canvas>` browser; hasil disimpan di `localStorage` (`twb.gallery.v1`, maks 8 foto) |
| Siapa pun boleh buat & share | tanpa login; setiap twibbon punya share link `/t/:slug` |
| PNG maksimal **3 MB** | batas Vercel untuk body request adalah 4,5 MB, base64 = 4/3 × ukuran file |

## Struktur

```
prisma/schema.prisma        model Twibbon (provider postgresql)
prisma.config.mjs           konfigurasi Prisma 7 (URL datasource + seed)
prisma/migrations/          migrasi awal (0_init) — dipakai `migrate deploy` di build
server/index.js             Express: API, cron, proxy gambar, halaman
server/lib/db.js            satu-satunya PrismaClient (driver adapter PrismaPg)
server/lib/config.js        LIMIT=50, WINDOW=14 hari, path/URL gambar
server/lib/storage.js       simpan/hapus file: Vercel Blob ATAU disk lokal
server/lib/cleanup.js       auto-delete twibbon kedaluwarsa
api/index.js                entry Vercel Function (export app)
vercel.json                 build, rewrite, cron
scripts/generate-templates.js   render 4 PNG sample (canvas di-import saat render)
public/                     HTML + CSS + JS (tanpa build step)
data/uploads/               file template mode lokal (gitignored)
```

## API

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/templates` | daftar twibbon aktif + `quota` global |
| GET | `/api/templates/:slug` | metadata 1 twibbon (404 kalau sudah hangus) |
| POST | `/api/templates` | `{title, author, description, image(dataURL PNG)}` → 201 / 400 / 413 / **429** |
| GET | `/api/cron/cleanup` | hapus twibbon kedaluwarsa (dipanggil Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`) |
| GET | `/uploads/:file` | file template mode lokal, CORS terbuka |
| GET | `/tpl/:id` | **proxy** template yang tersimpan di Vercel Blob — same-origin supaya canvas tidak kena CORS |
| GET | `/`, `/create`, `/gallery`, `/t/:slug` | halaman |

## Deploy ke Vercel

### 1. Buat database Prisma Postgres

```bash
npm i -g vercel@latest && vercel login && vercel link
vercel integration add prisma/prisma-postgres --name twibbonzr-db --no-env-pull
```

Atau via dashboard: project → **Storage** → Marketplace → **Prisma Postgres** → Create
(pilih region **sin1**) → **Connect** ke `production` + `preview` + `development`.

Env var yang terisi otomatis:

| Var | Untuk |
| --- | --- |
| `DATABASE_URL` (direct `db.prisma.io`) | CLI: `migrate deploy`, `db push`, Studio |
| `DATABASE_URL_POOLED` (`pooled.db.prisma.io`) | **runtime aplikasi** |
| `POSTGRES_URL`, `PRISMA_DATABASE_URL` | alias `DATABASE_URL` |

> Prisma Postgres sudah tidak memakai URL `prisma://` (Accelerate di-retire 1 Des 2026);
> semuanya `postgres://` + driver adapter.

Tambahkan juga `CRON_SECRET` (nilai acak) supaya `/api/cron/cleanup` tidak bisa dipanggil sembarang orang.

### 2. Buat Blob store untuk file template

Vercel tidak punya filesystem permanen, jadi `data/uploads/` tidak bisa dipakai di produksi.

**Storage → Blob → Create store dengan akses `public`** lalu connect ke project.
Setelah ter-connect, `server/lib/storage.js` otomatis memakai Blob (deteksi `BLOB_READ_WRITE_TOKEN`
/ OIDC) — `imageName` berisi URL Blob, dan gambarnya disajikan lewat proxy `/tpl/:id`
supaya `<canvas>` tetap same-origin.

### 3. Deploy

```bash
vercel env pull        # untuk menjalankan project secara lokal
vercel deploy
```

Build Vercel menjalankan (`vercel.json` → `buildCommand`):

```
prisma generate && prisma migrate deploy && node prisma/seed.js
```

- `prisma generate` juga ada di `postinstall` (Vercel men-cache dependencies).
- `migrate deploy` memakai `prisma/migrations/` (sudah ada migrasi awal).
  Untuk perubahan schema berikutnya: `npm run migrate:dev` lokal → commit folder migrasi.
- Seed **idempoten**: row yang sudah ada dilewati, expiry tidak pernah di-reset.
- `gen:templates` sengaja **tidak** dijalankan di build (modul native canvas tidak perlu ada di CI;
  PNG sample sudah ter-commit).

### 4. Yang sudah ditangani untuk serverless

| Masalah | Solusi |
| --- | --- |
| Tidak ada proses jangka panjang → `setInterval` mati | **Vercel Cron** harian 03.00 UTC → `/api/cron/cleanup` |
| Filesystem read-only + bersih tiap deploy | file template di **Vercel Blob** |
| `app.listen()` tidak dipakai | `api/index.js` export app; `listen` dibungkus `if (!process.env.VERCEL)` |
| Body request dibatasi 4,5 MB | PNG maksimal **3 MB** (base64 ≈ 4,0 MB) |
| `.env` tidak ada di Vercel | `process.loadEnvFile` dibungkus try/catch |
| Halaman HTML perlu file saat runtime | `functions.includeFiles: "public/**"` |

## Mekanisme compositing (inti reverse engineering)

1. Template = PNG dengan alpha channel — bagian transparan adalah lubang untuk foto.
2. Frontend fetch `GET /api/templates/:slug` lalu load PNG (via `/tpl/:id` bila disimpan di Blob).
3. Foto dibaca `FileReader` → `Image` (tidak dikirim ke server).
4. Canvas: `drawImage(foto)` dulu, baru `drawImage(twibbon)` di atasnya.
5. `canvas.toDataURL('image/png')` → download; atau disimpan ke galeri `localStorage`.
