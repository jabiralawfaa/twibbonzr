import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7 = driver adapter WAJIB.
 * Runtime (serverless) memakai URL POOLED; CLI/migrasi memakai URL DIRECT.
 */
const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || '';

export const isDbConfigured = Boolean(connectionString);

const SETUP_HINT =
  'DATABASE_URL belum di-set. Lokal: buat Prisma Postgres lalu `vercel env pull`. ' +
  'Di Vercel: connect Prisma Postgres di tab Storage, lalu deploy ulang.';

function createClient() {
  if (!connectionString) {
    // Belum ada koneksi: tetap layani halaman statis, tapi API menjawab 503
    // dengan pesan di atas (lihat error handler di server/index.js).
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === Symbol.toStringTag) return 'PrismaClient';
          const err = new Error(SETUP_HINT);
          err.code = 'DB_NOT_CONFIGURED';
          throw err;
        },
      }
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // Default v7 (0 / 10 dtk) terlalu agresif untuk kasus kita — samakan dengan v6.
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 300_000,
    }),
  });
}

// Satu instance per isolate (aman untuk hot-reload lokal & serverless).
const KEY = Symbol.for('twibbonzr.prisma');
export const prisma = globalThis[KEY] ?? (globalThis[KEY] = createClient());
