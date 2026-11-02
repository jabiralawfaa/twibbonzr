import { api, qs, toast, readFileAsDataURL, loadImage, refreshQuota } from './app.js';

const drop = qs('#drop');
const fileInput = qs('#file');
const preview = qs('#preview');
const previewEmpty = qs('#previewEmpty');
const previewMeta = qs('#previewMeta');
const submitBtn = qs('#submit');
const form = qs('#form');

let image = null; // dataURL PNG

/* ---------- kuota live ---------- */
api
  .list()
  .then((d) => {
    const q = d.quota;
    qs('#quotaInline').textContent =
      q.remaining > 0
        ? `sisa ${q.remaining} dari ${q.limit} slot`
        : `PENUH (50/50) — coba lagi setelah slot bebas`;
    if (q.remaining <= 0) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Kuota global penuh — tunggu slot bebas';
    }
  })
  .catch(() => {});

/* ---------- deskripsi counter ---------- */
qs('#description').addEventListener('input', (e) => {
  qs('#descCount').textContent = e.target.value.length;
});

/* ---------- dropzone ---------- */
const openPicker = () => fileInput.click();
drop.addEventListener('click', openPicker);
drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openPicker();
  }
});
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('dragover');
});
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('dragover');
  const f = e.dataTransfer.files?.[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) handleFile(e.target.files[0]);
});

async function handleFile(file) {
  if (file.type !== 'image/png') {
    toast('Format harus PNG (punya alpha channel).', 'err');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    toast('Ukuran file maksimal 3 MB.', 'err');
    return;
  }
  try {
    image = await readFileAsDataURL(file);
    const img = await loadImage(image, { crossOrigin: false });

    preview.src = image;
    preview.style.display = 'block';
    previewEmpty.style.display = 'none';
    qs('#dropTitle').textContent = file.name;
    qs('#dropHint').textContent = 'Klik untuk ganti file';
    previewMeta.textContent = `✓ ${file.name} siap diterbitkan`;
    qs('#mSize').textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
    qs('#mFormat').textContent = `PNG · ${(file.size / 1024).toFixed(0)} KB`;
    toast('PNG dimuat. Lubang transparan siap dipakai.');
  } catch (err) {
    image = null;
    toast(err.message, 'err');
  }
}

/* ---------- submit ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const author = qs('#author').value.trim();
  const title = qs('#title').value.trim();
  const description = qs('#description').value.trim();

  if (!author) return toast('Isi nama kamu dulu.', 'err');
  if (title.length < 3) return toast('Judul minimal 3 karakter.', 'err');
  if (!image) return toast('Upload PNG twibbon dulu.', 'err');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Menerbitkan…';
  try {
    const res = await api.create({ author, title, description, image });
    toast(`Twibbon "${res.template.title}" terbit! Sisa kuota: ${res.quota.remaining}`);
    refreshQuota();
    setTimeout(() => {
      window.location.href = res.template.sharePath;
    }, 650);
  } catch (err) {
    toast(err.message, 'err');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Terbitkan Twibbon →';
  }
});
