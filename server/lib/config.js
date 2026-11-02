import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PUBLIC_DIR = join(ROOT, 'public');
export const UPLOAD_DIR = join(ROOT, 'data', 'uploads');
export const TEMPLATE_DIR = join(PUBLIC_DIR, 'templates');

// Muat .env bila ada (nilai yang sudah ada di environment tidak ditimpa).
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  /* file .env opsional */
}

/**
 * Port server. Environment kadang meng-ekspor PORT=0 (artinya "random"),
 * itu kita anggap tidak valid dan jatuh ke 4173.
 */
const parsedPort = Number(process.env.PORT);
export const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4173;

/** Batas GLOBAL: total twibbon yang boleh "hidup" dalam satu jendela 14 hari. */
export const LIMIT = 50;
/** Satu jendela = 2 minggu. Twibbon juga hangus setelah rentang ini. */
export const WINDOW_DAYS = 14;
export const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Batas ukuran file template (byte). 3 MiB -> body base64 ~4,0 MB (limit Vercel 4,5 MB). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export const windowStart = (now = new Date()) => new Date(now.getTime() - WINDOW_MS);
export const expiryDate = (now = new Date()) => new Date(now.getTime() + WINDOW_MS);

/** Path file di disk untuk sebuah row twibbon. */
export const imagePath = (t) =>
  t.isSeed ? join(TEMPLATE_DIR, t.imageName) : join(UPLOAD_DIR, t.imageName);

/** URL publik untuk sebuah row twibbon. */
const isUrl = (v) => /^https?:\/\//i.test(String(v || ''));

export const imageUrl = (t) =>
  isUrl(t.imageName) // tersimpan di Vercel Blob -> lewat proxy same-origin
    ? `/tpl/${t.id}`
    : t.isSeed
      ? `/templates/${t.imageName}`
      : `/uploads/${t.imageName}`;
