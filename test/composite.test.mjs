// Self-check composite() — jalankan: npm test (node --test test/)
// app.js menyentuh document & fetch saat load; Node tidak punya keduanya,
// jadi di-stub seminimal mungkin sebelum import.
globalThis.document = {
  readyState: 'complete',
  querySelectorAll: () => [],
  getElementById: () => null,
};

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';

const { composite, fitSize } = await import('../public/js/app.js');

const px = (canvas, x, y) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
const solid = (w, h, color) => {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
};

test('canvas 1:1 + template square: menutup penuh, dimensi tidak berubah', () => {
  const canvas = createCanvas(1080, 1080);
  composite(canvas, { template: solid(1080, 1080, '#0000ff') });
  const [r, g, b] = px(canvas, 540, 540);
  assert.equal(b, 255);
  assert.equal(r, 0);
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1080);
});

test('canvas 9:16 + template square: contain-fit di tengah, tepi = background', () => {
  const canvas = createCanvas(1080, 1920);
  composite(canvas, { template: solid(1080, 1080, '#0000ff') });
  // tengah template (y=960) harus biru
  assert.equal(px(canvas, 540, 960)[2], 255);
  // dekat tepi atas (y=10) di luar area contain → background #0e0d16
  const [r, g, b] = px(canvas, 540, 10);
  assert.deepEqual([r, g, b], [0x0e, 0x0d, 0x16]);
});

test('foto cover-fit memenuhi seluruh canvas potret', () => {
  const canvas = createCanvas(1080, 1920);
  composite(canvas, { photo: solid(200, 100, '#00ff00') });
  const [r, g, b] = px(canvas, 2, 2);
  assert.equal(g, 255);
  assert.equal(r, 0);
  assert.equal(b, 0);
});

test('foto cover-fit memenuhi seluruh canvas lanskap', () => {
  const canvas = createCanvas(1600, 900);
  composite(canvas, { photo: solid(100, 100, '#ff0000') });
  const [r, g, b] = px(canvas, 1597, 897);
  assert.equal(r, 255);
  assert.equal(g, 0);
  assert.equal(b, 0);
});

test('fitSize keepRatio: rasio template terjaga saat melewati batas', () => {
  assert.deepEqual(fitSize(1080, 1920, { keepRatio: true }), { w: 1080, h: 1920 });
  assert.deepEqual(fitSize(5000, 5000, { keepRatio: true }), { w: 4096, h: 4096 });
  // 5000×3000 (rasio 5:3) → diperkecil proporsional, bukan di-clamp per sisi
  assert.deepEqual(fitSize(5000, 3000, { keepRatio: true }), { w: 4096, h: 2457 });
});

test('fitSize custom: clamp per sisi, input tak valid ditolak', () => {
  assert.deepEqual(fitSize(9999, 1080), { w: 4096, h: 1080 });
  assert.deepEqual(fitSize(100, 6000), { w: 400, h: 4096 });
  assert.deepEqual(fitSize(1080, 1080), { w: 1080, h: 1080 });
  assert.equal(fitSize('abc', 10), null);
  assert.equal(fitSize(0, -5), null);
});

test('rotasi foto: cover tetap penuh di sudut, template tidak ikut berputar', () => {
  const canvas = createCanvas(1080, 1080);
  const photo = solid(100, 100, '#00ff00');
  // template: kotak merah 200×200 di kiri-atas, sisanya transparan
  const tmpl = createCanvas(1080, 1080);
  const tctx = tmpl.getContext('2d');
  tctx.fillStyle = '#ff0000';
  tctx.fillRect(0, 0, 200, 200);

  composite(canvas, { template: tmpl, photo, rotate: 45 });
  // pojok kiri-atas = milik template (digambar terakhir, tidak berputar)
  assert.deepEqual(px(canvas, 5, 5).slice(0, 3), [255, 0, 0]);
  // pojok kanan-bawah = foto; tanpa skala-rotasi yang benar ini jadi background
  assert.deepEqual(px(canvas, 1074, 1074).slice(0, 3), [0, 255, 0]);
});
