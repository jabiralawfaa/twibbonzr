import {
  api,
  qs,
  esc,
  toast,
  fmtDate,
  fmtDur,
  startCountdown,
  loadImage,
  readFileAsDataURL,
  composite,
  downloadDataUrl,
  gallery,
  shareTargets,
  copyText,
} from './app.js';

const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
const canvas = qs('#canvas');

const state = {
  template: null,
  photo: null,
  zoom: 1,
  x: 0,
  y: 0,
  info: null,
};

function renderCanvas() {
  composite(canvas, {
    template: state.template,
    photo: state.photo,
    zoom: state.zoom,
    offsetX: state.x,
    offsetY: state.y,
  });
}

function showError(title, msg) {
  qs('#errorState').style.display = '';
  qs('#content').style.display = 'none';
  qs('#errorTitle').textContent = title;
  qs('#errorMsg').textContent = msg;
  qs('#crumbTitle').textContent = 'tidak ditemukan';
}

/* ---------------- load data twibbon ---------------- */
async function boot() {
  let t;
  try {
    const res = await api.get(slug);
    t = res.template;
  } catch (err) {
    showError('Twibbon tidak ditemukan', err.message);
    return;
  }

  state.info = t;
  document.title = `${t.title} — Twibbonzr`;
  qs('#crumbTitle').textContent = t.title;
  qs('#title').textContent = t.title;
  qs('#author').innerHTML = `by <b>@${esc(t.author)}</b>`;
  qs('#description').textContent = t.description || '';
  qs('#description').style.display = t.description ? '' : 'none';
  qs('#mCreated').textContent = fmtDate(t.createdAt);
  qs('#mExpires').textContent = fmtDate(t.expiresAt);
  qs('#badges').innerHTML = `
    <span class="chip ${t.isSeed ? 'chip-seed' : 'chip-hot'}">${t.isSeed ? '⭐ official' : '🔥 tayang sekarang'}</span>
    <span class="chip">1080 × 1080 px</span>
    <span class="chip chip-lime">PNG + alpha</span>`;
  startCountdown(qs('#countdown'), t.expiresAt);

  // kuota
  api
    .list()
    .then((d) => {
      qs('#mQuota').textContent = `${d.quota.remaining} dari ${d.quota.limit} slot`;
      const others = d.templates.filter((x) => x.slug !== t.slug).slice(0, 8);
      qs('#others').innerHTML = others.length
        ? others
            .map(
              (o) =>
                `<a class="chip ${o.slug === t.slug ? 'chip-lime' : ''}" href="/t/${esc(o.slug)}" style="font-size:.8rem">${esc(o.title)}</a>`
            )
            .join('')
        : '<span class="chip">belum ada twibbon lain</span>';
    })
    .catch(() => {});

  // share
  const url = `${location.origin}/t/${t.slug}`;
  const text = `Ikut pasang twibbon "${t.title}" by @${t.author}! 🔥`;
  qs('#shareLink').value = url;
  const targets = shareTargets(url, text);
  qs('#waBtn').href = targets.whatsapp;
  qs('#xBtn').href = targets.x;
  qs('#tgBtn').href = targets.telegram;
  qs('#copyBtn').addEventListener('click', async () => {
    const done = await copyText(url);
    toast(done ? 'Link share disalin!' : 'Gagal menyalin link.', done ? 'ok' : 'err');
  });
  qs('#nativeBtn').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.title, text, url });
      } catch {
        /* user batal */
      }
    } else {
      const done = await copyText(url);
      toast(done ? 'Browser ini nggak mendukung Share — link sudah disalin!' : 'Gagal menyalin.', done ? 'ok' : 'err');
    }
  });

  // gambar template
  try {
    state.template = await loadImage(t.imageUrl);
    qs('#mSize').textContent = `${state.template.naturalWidth} × ${state.template.naturalHeight} px`;
  } catch (err) {
    toast(err.message, 'err');
  }

  qs('#content').style.display = '';
  renderCanvas();
}

/* ---------------- foto (hanya lokal) ---------------- */
const photoDrop = qs('#photoDrop');
const photoFile = qs('#photoFile');

photoDrop.addEventListener('click', () => photoFile.click());
photoDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    photoFile.click();
  }
});
photoDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  photoDrop.classList.add('dragover');
});
photoDrop.addEventListener('dragleave', () => photoDrop.classList.remove('dragover'));
photoDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDrop.classList.remove('dragover');
  if (e.dataTransfer.files?.[0]) loadPhoto(e.dataTransfer.files[0]);
});
photoFile.addEventListener('change', (e) => {
  if (e.target.files?.[0]) loadPhoto(e.target.files[0]);
});

async function loadPhoto(file) {
  if (!file.type.startsWith('image/')) return toast('File bukan gambar.', 'err');
  try {
    const dataUrl = await readFileAsDataURL(file);
    state.photo = await loadImage(dataUrl, { crossOrigin: false });
    qs('#photoTitle').textContent = file.name;
    qs('#photoHint').textContent = `${state.photo.naturalWidth} × ${state.photo.naturalHeight} px · hanya di browser kamu`;
    renderCanvas();
    toast('Foto dimuat. Atur zoom & posisi.');
  } catch (err) {
    toast(err.message, 'err');
  }
}

/* ---------------- kontrol ---------------- */
const bind = (id, key, out, fmt) => {
  const input = qs(id);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    state[key] = key === 'zoom' ? v / 100 : v;
    qs(out).textContent = fmt(v);
    renderCanvas();
  });
};
bind('#zoom', 'zoom', '#zoomVal', (v) => `${v}%`);
bind('#offsetX', 'x', '#offsetXVal', (v) => `${v}`);
bind('#offsetY', 'y', '#offsetYVal', (v) => `${v}`);

function resetControls() {
  state.photo = null;
  state.zoom = 1;
  state.x = 0;
  state.y = 0;
  qs('#zoom').value = 100;
  qs('#offsetX').value = 0;
  qs('#offsetY').value = 0;
  qs('#zoomVal').textContent = '100%';
  qs('#offsetXVal').textContent = '0';
  qs('#offsetYVal').textContent = '0';
  qs('#photoTitle').textContent = 'Klik atau tarik foto kamu';
  qs('#photoHint').textContent = 'JPG/PNG · foto tidak pernah di-upload';
  photoFile.value = '';
  renderCanvas();
}

qs('#resetBtn').addEventListener('click', () => {
  resetControls();
  toast('Direset. Upload foto untuk mulai.');
});

qs('#downloadBtn').addEventListener('click', () => {
  if (!state.photo) return toast('Upload foto dulu sebelum download.', 'err');
  downloadDataUrl(canvas.toDataURL('image/png'), `twibbon-${slug}.png`);
  toast('Hasil didownload sebagai PNG 1080×1080.');
});

qs('#saveBtn').addEventListener('click', () => {
  if (!state.photo) return toast('Upload foto dulu sebelum disimpan.', 'err');
  try {
    const res = gallery.save(canvas, {
      title: state.info?.title || 'Twibbon',
      slug,
      author: state.info?.author || '',
    });
    toast(
      res.dropped > 0
        ? `Tersimpan di Galeri (${res.dropped} foto lama dibuang, kuota storage penuh).`
        : `Tersimpan di Galeri Lokal (${res.count}/8).`
    );
  } catch (err) {
    toast(err.message, 'err');
  }
});

boot();
