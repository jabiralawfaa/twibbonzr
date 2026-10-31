/**
 * Generator sample twibbon (PNG + alpha channel).
 *
 * Merekonstruksi desain dari hasil reverse engineering:
 *   - latar magenta pekat
 *   - border glow oranye-merah di keempat tepi (soft-edged gradient)
 *   - 4 titik warna di sudut (kuning, hijau, biru, pink)
 *   - LUBANG BULAT TRANSPARAN di tengah -> tempat foto user (alpha = 0)
 *   - badge gelap "SUPPORT KAMI!" menimpa bagian bawah lingkaran
 *   - hashtag "#TwibbonzrDemo" oranye-kuning di bawah badge
 *
 * Hasilnya PNG RGBA asli, bisa langsung di-composite di <canvas> browser.
 */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'templates');
const SIZE = 1080;
const GLOW_BAND = 112; // seberapa jauh glow menembus ke dalam

export const TEMPLATES = [
  {
    file: 'seed-support-kami.png',
    slug: 'support-kami',
    title: 'Support Kami!',
    author: 'tim.twibbonzr',
    description:
      'Twibbon resmi demo #TwibbonzrDemo. Pasang foto kamu di lubang tengah, sebar linknya ke semua orang.',
    bg: '#DA3AA5',
    glow: '#FF4B12',
    dots: ['#FFDE3D', '#86F03C', '#5CD3FF', '#FF8FD0'],
    badge: 'SUPPORT KAMI!',
    hashtag: '#TwibbonzrDemo',
    hashColor: '#FFAE1A',
    hole: { cx: 540, cy: 470, r: 345 },
  },
  {
    file: 'seed-gaskeun-2026.png',
    slug: 'gaskeun-2026',
    title: 'Gaskeun 2026',
    author: 'anak.lambda',
    description: 'Buat kampanye kelas/kegiatan tahunan. Share linknya, biar semua ikut pasang.',
    bg: '#5B2BD9',
    glow: '#FF2E93',
    dots: ['#B7FF3C', '#FFE14D', '#38D9FF', '#FF8FD0'],
    badge: 'GASKEUN 2026!',
    hashtag: '#GaskeunWave',
    hashColor: '#FFE14D',
    hole: { cx: 540, cy: 460, r: 350 },
  },
  {
    file: 'seed-level-up.png',
    slug: 'level-up',
    title: 'Level Up!',
    author: 'galih.dev',
    description: 'Template buat komunitas gaming/kampus. Desain dark, cocok untuk foto profil.',
    bg: '#0E1B3A',
    glow: '#25E0FF',
    dots: ['#FFE14D', '#FF5C1A', '#B7FF3C', '#FF3EA5'],
    badge: 'LEVEL UP!',
    hashtag: '#LevelUpDays',
    hashColor: '#25E0FF',
    hole: { cx: 540, cy: 475, r: 332 },
  },
  {
    file: 'seed-makin-kece.png',
    slug: 'makin-kece',
    title: 'Makin Kece',
    author: 'naya.png',
    description: 'Warna panas buat event outdoor. Tinggal upload foto, langsung kece.',
    bg: '#F9600F',
    glow: '#FFD23C',
    dots: ['#FFFFFF', '#B7FF3C', '#38D9FF', '#FF3EA5'],
    badge: 'MAKIN KECE!',
    hashtag: '#MakinKece',
    hashColor: '#FFF3C4',
    hole: { cx: 540, cy: 465, r: 338 },
  },
];

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a + (b - a) * t;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Latar solid + glow oranye-merah yang lembut di keempat tepi. */
function drawBackgroundWithGlow(ctx, bgHex, glowHex) {
  const bg = hex(bgHex);
  const glow = hex(glowHex);
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  for (let y = 0; y < SIZE; y++) {
    const dy = Math.min(y, SIZE - 1 - y);
    for (let x = 0; x < SIZE; x++) {
      const dist = Math.min(Math.min(x, SIZE - 1 - x), dy);
      let t = dist / GLOW_BAND;
      if (t > 1) t = 1;
      const e = Math.pow(1 - t, 1.7); // 1 persis di tepi -> 0 ke arah dalam
      const i = (y * SIZE + x) * 4;
      d[i] = mix(bg[0], glow[0], e);
      d[i + 1] = mix(bg[1], glow[1], e);
      d[i + 2] = mix(bg[2], glow[2], e);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function fitFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 12) {
    size -= 2;
    ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
  }
  return size;
}

export function renderTemplate(spec) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // 1. latar + glow tepi
  drawBackgroundWithGlow(ctx, spec.bg, spec.glow);

  // 2. empat titik warna di sudut
  const inset = 78;
  const r = 27;
  const positions = [
    [inset, inset],
    [SIZE - inset, inset],
    [inset, SIZE - inset],
    [SIZE - inset, SIZE - inset],
  ];
  positions.forEach(([x, y], i) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = spec.dots[i];
    ctx.fill();
  });

  // 3. LUBANG TRANSPARAN (inti mekanisme twibbon)
  const { cx, cy, r: hr } = spec.hole;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. badge (menimpa bagian bawah lingkaran)
  const fontSize = fitFont(ctx, spec.badge, SIZE * 0.62, 52);
  const tw = ctx.measureText(spec.badge).width;
  const bw = Math.ceil(tw + 96);
  const bh = Math.ceil(fontSize + 56);
  const bx = (SIZE - bw) / 2;
  const by = cy + hr - 130;
  roundedRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = '#1B1B21';
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.badge, SIZE / 2, by + bh / 2 + 2);

  // 5. hashtag di bawah badge
  ctx.font = `bold 34px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = spec.hashColor;
  ctx.fillText(spec.hashtag, SIZE / 2, by + bh + 46);

  return canvas;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const spec of TEMPLATES) {
    const target = join(OUT_DIR, spec.file);
    const exists = existsSync(target);
    const canvas = renderTemplate(spec);
    const png = await canvas.encode('png');
    writeFileSync(target, png);
    written += 1;
    console.log(`${exists ? 'update' : 'create'} ${spec.file} (${(png.length / 1024).toFixed(0)} KB)`);
  }
  console.log(`✔ ${written} template PNG siap di public/templates/`);
}

if (process.argv[1] && process.argv[1].endsWith('generate-templates.js')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
