import { TEMPLATES } from '../scripts/generate-templates.js';
import { expiryDate } from '../server/lib/config.js';
import { prisma } from '../server/lib/db.js';

/**
 * Seed idempoten: row yang sudah ada TIDAK disentuh.
 * Penting untuk deploy Vercel — kalau pakai upsert, expiry semua twibbon
 * ikut ter-reset tiap kali build jalan.
 */
async function main() {
  const now = new Date();
  const expires = expiryDate(now);
  let created = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const exists = await prisma.twibbon.findUnique({ where: { slug: t.slug } });
    if (exists) {
      skipped += 1;
      console.log(`• ${t.slug} sudah ada — dilewati (expiry tidak di-reset)`);
      continue;
    }
    await prisma.twibbon.create({
      data: {
        slug: t.slug,
        title: t.title,
        description: t.description,
        author: t.author,
        imageName: `/templates/${t.file}`,
        isSeed: true,
        createdAt: now,
        expiresAt: expires,
      },
    });
    created += 1;
    console.log(`✔ seed ${t.slug}`);
  }

  const count = await prisma.twibbon.count();
  console.log(`\n✔ ${created} seed baru, ${skipped} dilewati (${count} row di DB).`);
  console.log(`  Twibbon baru hangus otomatis ${expires.toLocaleString('id-ID')}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
