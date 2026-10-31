import { LIMIT, WINDOW_MS, windowStart } from './config.js';

/**
 * Kuota GLOBAL (bukan per-user): semua orang berbagi slot yang sama.
 * Dihitung dari row yang dibuat dalam jendela 14 hari berjalan.
 */
export async function getQuota(prisma) {
  const now = new Date();
  const used = await prisma.twibbon.count({
    where: { createdAt: { gte: windowStart(now) } },
  });
  const remaining = Math.max(0, LIMIT - used);

  // Slot berikutnya bebas saat twibbon paling awal di jendela ikut hangus.
  let nextSlotAt = null;
  if (remaining === 0) {
    const oldest = await prisma.twibbon.findFirst({
      where: { createdAt: { gte: windowStart(now) } },
      orderBy: { createdAt: 'asc' },
      select: { expiresAt: true },
    });
    nextSlotAt = oldest?.expiresAt ?? null;
  }

  return {
    limit: LIMIT,
    used,
    remaining,
    windowDays: Math.round(WINDOW_MS / 86400000),
    nextSlotAt: nextSlotAt ? nextSlotAt.toISOString() : null,
  };
}
