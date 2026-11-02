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

const { composite } = await import('../public/js/app.js');

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
