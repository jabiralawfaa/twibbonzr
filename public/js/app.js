/* =========================================================
   Twibbonzr — modul bersama
   - API client (Prisma-backed, lewat /api)
   - Engine compositing Canvas (foto TIDAK PERNAH dikirim ke server)
   - Galeri hasil yang hanya disimpan di localStorage
   ========================================================= */

const API = '/api';
const GAL_KEY = 'twb.gallery.v1';
const GAL_MAX = 8;

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/* ---------------- API ---------------- */
async function request(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

let listPromise = null;

export const api = {
  list({ force = false } = {}) {
    if (!listPromise || force) {
      listPromise = request(`${API}/templates`).catch((err) => {
        listPromise = null;
        throw err;
      });
    }
    return listPromise;
  },
  get: (slug) => request(`${API}/templates/${encodeURIComponent(slug)}`),
  create: (payload) =>
    request(`${API}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};

/* ---------------- toast ---------------- */
let toastEl = null;
let toastTimer = null;

export function toast(message, type = 'ok') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = (type === 'err' ? '⚠ ' : '✓ ') + message;
  toastEl.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3400);
}

/* ---------------- waktu ---------------- */
export function fmtDur(ms) {
  if (ms <= 0) return 'hangus';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit ${s} detik`;
  return `${s} detik`;
}

export function fmtShort(iso) {
  const left = new Date(iso).getTime() - Date.now();
  if (left <= 0) return 'hangus';
  const d = Math.floor(left / 86400000);
  const h = Math.floor(left / 3600000) % 24;
  if (d > 0) return `${d} hari lagi`;
  if (h > 0) return `${h} jam lagi`;
  return `${Math.max(1, Math.floor(left / 60000))} menit lagi`;
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Update elemen countdown tiap detik. Mengembalikan fungsi stop. */
export function startCountdown(el, iso, fmt = fmtDur) {
  const tick = () => {
    const left = new Date(iso).getTime() - Date.now();
    if (left <= 0) {
      el.textContent = 'sudah hangus';
      clearInterval(timer);
      return;
    }
    el.textContent = fmt(left);
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

/* ---------------- gambar & composite ---------------- */
export function loadImage(src, { crossOrigin = true } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
    img.src = src;
  });
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File tidak bisa dibaca.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Inti mekanisme Twibbonzr:
 *   A. foto user sebagai background  ->  B. PNG twibbon di atasnya.
 * Alpha channel PNG membuat bagian lubang transparan menampilkan foto.
 */
export function composite(canvas, { template = null, photo = null, zoom = 1, offsetX = 0, offsetY = 0, rotate = 0 } = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // background solid supaya area letterbox (rasio beda) tidak transparan
  ctx.fillStyle = '#0e0d16';
  ctx.fillRect(0, 0, W, H);

  if (photo) {
    // rotasi mengubah kebutuhan skala: sudut kanvas dipetakan ke ruang foto
    // agar cover tetap penuh pada sudut berapa pun (bukan sekadar bounding-box)
    const rad = (rotate * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const sn = Math.abs(Math.sin(rad));
    const needW = W * c + H * sn;
    const needH = W * sn + H * c;
    const scale = Math.max(needW / photo.width, needH / photo.height) * zoom;
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    // offset diterapkan di ruang layar (sebelum rotasi) supaya geser X/Y tetap arah layar
    ctx.save();
    ctx.translate(W / 2 + offsetX, H / 2 + offsetY);
    ctx.rotate(rad);
    ctx.drawImage(photo, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  if (template) {
    // template contain-fit di tengah — tidak pernah melar walau rasio beda
    const s = Math.min(W / template.width, H / template.height);
    const dw = template.width * s;
    const dh = template.height * s;
    ctx.drawImage(template, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
}

/** Batas ukuran output: per sisi 400..4096 px, total maks 16,7 MP (aman untuk canvas iOS). */
export const SIZE_MIN = 400;
export const SIZE_MAX = 4096;
export const SIZE_MAX_PIXELS = 16777216;

/**
 * Clamp ukuran output ke batas aman. Mengembalikan {w,h} atau null bila tidak valid.
 * keepRatio=true  → skalakan proporsional (default = ukuran asli template, rasio terjaga)
 * keepRatio=false → clamp per sisi (user mengetik angka eksplisit di kolom custom)
 */
export function fitSize(w, h, { keepRatio = false } = {}) {
  w = Math.round(Number(w));
  h = Math.round(Number(h));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  if (!keepRatio) {
    return {
      w: Math.min(SIZE_MAX, Math.max(SIZE_MIN, w)),
      h: Math.min(SIZE_MAX, Math.max(SIZE_MIN, h)),
    };
  }
  const k = Math.min(1, SIZE_MAX / w, SIZE_MAX / h, Math.sqrt(SIZE_MAX_PIXELS / (w * h)));
  if (k >= 1) return { w, h };
  return {
    w: Math.max(SIZE_MIN, Math.floor(w * k)),
    h: Math.max(SIZE_MIN, Math.floor(h * k)),
  };
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------- galeri localStorage ---------------- */
function scaleCanvas(canvas, factor) {
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * factor);
  c.height = Math.round(canvas.height * factor);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

export const gallery = {
  all() {
    try {
      const v = JSON.parse(localStorage.getItem(GAL_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  },
  remove(id) {
    const items = this.all().filter((i) => i.id !== id);
    localStorage.setItem(GAL_KEY, JSON.stringify(items));
    return items;
  },
  /**
   * Simpan hasil composite. JPEG karena hasil selalu opaque (ada background fill),
   * jauh lebih hemat kuota localStorage dibanding PNG.
   */
  save(canvas, meta) {
    const items = this.all();
    let dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    if (dataUrl.length > 650000) dataUrl = scaleCanvas(canvas, 0.72).toDataURL('image/jpeg', 0.85);

    items.unshift({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      title: meta.title || 'Twibbon',
      slug: meta.slug || '',
      author: meta.author || '',
      createdAt: new Date().toISOString(),
      dataUrl,
    });

    let dropped = 0;
    while (items.length > GAL_MAX) {
      items.pop();
      dropped += 1;
    }
    for (;;) {
      try {
        localStorage.setItem(GAL_KEY, JSON.stringify(items));
        return { count: items.length, dropped };
      } catch {
        if (items.length <= 1) {
          throw new Error('Storage browser penuh. Hapus beberapa hasil di Galeri dulu.');
        }
        items.pop();
        dropped += 1;
      }
    }
  },
};

/* ---------------- share ---------------- */
export function shareTargets(url, text) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
  };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const done = document.execCommand('copy');
    ta.remove();
    return done;
  }
}

/* ---------------- shell: quota pill + reveal ---------------- */
function paintQuota(quota) {
  const pill = document.getElementById('quotaPill');
  if (!pill || !quota) return;
  const full = quota.remaining <= 0;
  pill.classList.toggle('full', full);
  pill.innerHTML = full
    ? `<span class="pulse"></span> kuota penuh · ${quota.limit}/${quota.limit}`
    : `<span class="pulse"></span> sisa kuota ${quota.remaining}/${quota.limit}`;
  pill.title = `Kuota global: ${quota.used} dari ${quota.limit} twibbon dalam ${quota.windowDays} hari terakhir (dipakai semua orang)`;
}

export function refreshQuota() {
  return api
    .list()
    .then((d) => paintQuota(d.quota))
    .catch(() => {});
}

function initReveal() {
  const els = qsa('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

// dijalankan setiap halaman memuat modul ini
refreshQuota();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReveal);
} else {
  initReveal();
}
