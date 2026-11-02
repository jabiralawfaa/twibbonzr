import { WINDOW_MS } from './config.js';
import { removeTemplate } from './storage.js';

/**
 * Hapus twibbon yang lewat 2 minggu: file gambar dulu, lalu row di database.
 * Berjalan saat boot + tiap menit.
 */
export async function sweep(prisma, { log = true } = {}) {
  const now = new Date();
  const expired = await prisma.twibbon.findMany({
    where: { expiresAt: { lte: now } },
  });
  if (expired.length === 0) return 0;

  let filesRemoved = 0;
  for (const t of expired) {
    try {
      await removeTemplate(t.imageName);
      filesRemoved += 1;
    } catch {
      /* file mungkin sudah tidak ada — biarkan */
    }
  }
  await prisma.twibbon.deleteMany({ where: { id: { in: expired.map((t) => t.id) } } });

  if (log) {
    console.log(
      `[cleanup] ${expired.length} twibbon kedaluwarsa dihapus (${filesRemoved} file), umur maks ${WINDOW_MS / 86400000} hari`
    );
  }
  return expired.length;
}

export function startCleanup(prisma, intervalMs = 60_000) {
  const tick = () => sweep(prisma).catch((err) => console.error('[cleanup] gagal:', err.message));
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}
