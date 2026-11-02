/**
 * Prisma 7 — konfigurasi pindah dari package.json & schema ke file ini.
 *   - datasource.url dipakai CLI (migrate/push/studio) -> pakai URL DIRECT (DATABASE_URL)
 *   - runtime app pakai adapter @prisma/adapter-pg dengan URL POOLED (DATABASE_URL_POOLED)
 *   - env tidak dimuat otomatis di v7, jadi kita load sendiri (opsional).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const ROOT = dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  /* .env opsional — di Vercel env datang dari platform */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  // Kosongkan dengan aman saat build generate (prisma generate tidak butuh koneksi).
  datasource: {
    url: process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || '',
  },
});
