import { qs, esc, toast, gallery, downloadDataUrl, fmtDate } from './app.js';

const grid = qs('#grid');

function usageText() {
  const raw = localStorage.getItem('twb.gallery.v1') || '';
  return `${(raw.length / 1024 / 1024).toFixed(2)} MB`;
}

function itemHtml(i) {
  return `
  <article class="gal-item reveal" data-id="${esc(i.id)}">
    <img src="${i.dataUrl}" alt="Hasil twibbon ${esc(i.title)}">
    <div class="gal-foot">
      <div>
        <div class="t">${esc(i.title)}</div>
        <div class="d">disimpan ${esc(fmtDate(i.createdAt))} · hanya di browser ini</div>
      </div>
      <div class="gal-actions">
        <button class="btn btn-lime" data-act="download">⬇ Unduh</button>
        <button class="btn btn-ghost" data-act="delete">Hapus</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const items = gallery.all();
  qs('#usage').textContent = usageText();

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="big">🗂️</div>
        <h3>Belum ada hasil tersimpan</h3>
        <p>Pilih twibbon dari Area Rekomendasi, pasang foto kamu, lalu tekan
          <b style="color:var(--ink)">Simpan ke Galeri</b>.</p>
        <a class="btn btn-primary" href="/#rekomendasi">Mulai dari Rekomendasi</a>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(itemHtml).join('');
  [...grid.children].forEach((el, idx) => setTimeout(() => el.classList.add('in'), 60 * idx));
}

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const card = btn.closest('[data-id]');
  const id = card?.dataset.id;
  const items = gallery.all();
  const item = items.find((i) => i.id === id);
  if (!item) return;

  if (btn.dataset.act === 'download') {
    downloadDataUrl(item.dataUrl, `twibbon-${item.slug || 'hasil'}-${item.id}.jpg`);
    toast('Hasil diunduh.');
    return;
  }

  if (btn.dataset.act === 'delete') {
    if (!confirm(`Hapus "${item.title}" dari galeri lokal?`)) return;
    gallery.remove(id);
    toast('Dihapus dari localStorage.');
    render();
  }
});

render();
