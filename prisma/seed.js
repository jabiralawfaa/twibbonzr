import { PrismaClient } from '@prisma/client';
import { TEMPLATES } from '../scripts/generate-templates.js';
import { expiryDate } from '../server/lib/config.js';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const expires = expiryDate(now);

  for (const t of TEMPLATES) {
    const data = {
      title: t.title,
      description: t.description,
      author: t.author,
      imageName: t.file,
      isSeed: true,
      createdAt: now,
      expiresAt: expires,
    };
    await prisma.twibbon.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, ...data },
      update: data,
    });
    console.log(`✔ seed ${t.slug}`);
  }

  const count = await prisma.twibbon.count();
  console.log(`\n✔ ${TEMPLATES.length} sample twibbon siap (${count} row total di DB).`);
  console.log(`  Mereka hangus otomatis ${expires.toLocaleString('id-ID')}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
