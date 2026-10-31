import express from 'express';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import {
  PORT,
  PUBLIC_DIR,
  UPLOAD_DIR,
  MAX_IMAGE_BYTES,
  WINDOW_MS,
  expiryDate,
  imageUrl,
} from './lib/config.js';
import { getQuota } from './lib/quota.js';
import { startCleanup, sweep } from './lib/cleanup.js';

const prisma = new PrismaClient();
const app = express();

mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '8mb' }));

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const fail = (res, status, error) => res.status(status).json({ ok: false, error });
const ok = (res, data, status = 200) => res.status(status).json({ ok: true, ...data });

function shape(t) {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    author: t.author,
    imageUrl: imageUrl(t),
    isSeed: t.isSeed,
    createdAt: t.createdAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    expiresInMs: t.expiresAt.getTime() - Date.now(),
    sharePath: `/t/${t.slug}`,
  };
}

function slugify(str) {
  const base = String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  return base || 'twibbon';
}

const uniqueSlug = (title) => `${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`;

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function parsePng(buf) {
  if (buf.length < 33) return null;
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

/* ------------------------------------------------------------------ */
/* API: twibbon                                                        */
/* ------------------------------------------------------------------ */

// Daftar twibbon aktif + kuota global. Ini yang mengisi Area Rekomendasi.
app.get('/api/templates', async (req, res, next) => {
  try {
    const now = new Date();
    const [templates, quota] = await Promise.all([
      prisma.twibbon.findMany({
        where: { expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
      }),
      getQuota(prisma),
    ]);
    ok(res, { templates: templates.map(shape), quota });
  } catch (err) {
    next(err);
  }
});

// Metadata 1 twibbon (dipanggil frontend saat halaman /t/:slug dibuka).
app.get('/api/templates/:slug', async (req, res, next) => {
  try {
    const t = await prisma.twibbon.findUnique({ where: { slug: req.params.slug } });
    if (!t || t.expiresAt.getTime() <= Date.now()) {
      return fail(res, 404, 'Twibbon tidak ditemukan atau sudah hangus (2 minggu).');
    }
    ok(res, { template: shape(t) });
  } catch (err) {
    next(err);
  }
});

// Buat twibbon baru — semua orang boleh, tanpa login.
// Dibatasi kuota GLOBAL: 50 twibbon per jendela 14 hari.
app.post('/api/templates', async (req, res, next) => {
  try {
    const { title, description = '', author = '', image } = req.body || {};

    const cleanTitle = String(title ?? '').trim();
    const cleanAuthor = String(author ?? '').trim() || 'Anonim';
    const cleanDesc = String(description ?? '').trim().slice(0, 280);

    if (cleanTitle.length < 3 || cleanTitle.length > 80) {
      return fail(res, 400, 'Judul twibbon harus 3–80 karakter.');
    }
    if (cleanAuthor.length > 40) return fail(res, 400, 'Nama kamu maksimal 40 karakter.');
    if (typeof image !== 'string' || !/^data:image\/png;base64,/i.test(image)) {
      return fail(res, 400, 'Gambar twibbon harus file PNG.');
    }

    const buf = Buffer.from(image.replace(/^data:image\/png;base64,/i, ''), 'base64');
    if (buf.length === 0) return fail(res, 400, 'File gambar kosong.');
    if (buf.length > MAX_IMAGE_BYTES) return fail(res, 413, 'Ukuran PNG maksimal 6 MB.');

    const meta = parsePng(buf);
    if (!meta) return fail(res, 400, 'File itu bukan PNG yang valid.');
    if (meta.width < 400 || meta.height < 400) {
      return fail(res, 400, 'Ukuran twibbon minimal 400×400 px.');
    }
    if (meta.width > 5000 || meta.height > 5000) {
      return fail(res, 400, 'Ukuran twibbon maksimal 5000×5000 px.');
    }

    // Kuota dicek di dalam transaksi supaya request paralel tidak tembus 50.
    const now = new Date();
    const windowFrom = new Date(now.getTime() - WINDOW_MS);
    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const used = await tx.twibbon.count({ where: { createdAt: { gte: windowFrom } } });
        if (used >= 50) {
          const err = new Error('QUOTA');
          err.code = 'QUOTA';
          throw err;
        }
        const slug = uniqueSlug(cleanTitle);
        const file = `${slug}.png`;
        writeFileSync(`${UPLOAD_DIR}/${file}`, buf);
        return tx.twibbon.create({
          data: {
            slug,
            title: cleanTitle,
            description: cleanDesc,
            author: cleanAuthor,
            imageName: file,
            isSeed: false,
            createdAt: now,
            expiresAt: expiryDate(now),
          },
        });
      });
    } catch (err) {
      if (err.code === 'QUOTA') {
        const quota = await getQuota(prisma);
        res.setHeader('Retry-After', '3600');
        return fail(
          res,
          429,
          `Kuota global penuh: 50 twibbon untuk 14 hari. Slot berikutnya bebas ${
            quota.nextSlotAt ? new Date(quota.nextSlotAt).toLocaleString('id-ID') : 'segera'
          } — coba lagi nanti.`
        );
      }
      throw err;
    }

    const quota = await getQuota(prisma);
    ok(res, { template: shape(created), quota }, 201);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* static assets                                                       */
/* ------------------------------------------------------------------ */

// Gambar template yang di-upload (disimpan di data/uploads/, bukan di DB).
// CORS dibuka supaya aman dipakai sebagai sumber <canvas>.
app.get('/uploads/:file', (req, res) => {
  const name = String(req.params.file);
  if (!/^[a-zA-Z0-9_-]+\.png$/.test(name)) return fail(res, 400, 'Nama file tidak valid.');
  const file = `${UPLOAD_DIR}/${name}`;
  if (!existsSync(file)) return fail(res, 404, 'File tidak ditemukan.');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('image/png').sendFile(file);
});

app.use(express.static(PUBLIC_DIR, { index: false }));

/* ------------------------------------------------------------------ */
/* halaman (share link friendly)                                       */
/* ------------------------------------------------------------------ */
const page = (file) => (req, res) => res.sendFile(`${PUBLIC_DIR}/${file}`);
app.get('/', page('index.html'));
app.get('/create', page('create.html'));
app.get('/gallery', page('gallery.html'));
app.get('/t/:slug', page('twibbon.html'));

app.use('/api', (req, res) => fail(res, 404, 'Endpoint tidak ditemukan.'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') return fail(res, 400, 'JSON tidak valid.');
  if (err?.type === 'entity.too.large') return fail(res, 413, 'Payload terlalu besar.');
  console.error('[server]', err);
  fail(res, 500, 'Terjadi kesalahan di server.');
});

/* ------------------------------------------------------------------ */
app.listen(PORT, async () => {
  await sweep(prisma).catch((e) => console.error('[cleanup]', e.message));
  startCleanup(prisma);
  console.log(`\n  ▟ Twibbonzr jalan → http://localhost:${PORT}`);
  console.log('  ▸ kuota global   : 50 twibbon / 14 hari');
  console.log('  ▸ database       : prisma/dev.db (SQLite)');
  console.log('  ▸ upload folder  : data/uploads/\n');
});
