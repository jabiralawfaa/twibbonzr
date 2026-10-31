import { api, qs, esc, toast, fmtShort, gallery } from './app.js';

const grid = qs('#grid');

function cardHtml(t) {
  const days = Math.max(0, Math.floor(t.expiresInMs / 86400000));
  return `
  <a class="card reveal" href="/t/${esc(t.slug)}">
    <div class="card-media checker">
      <img src="${esc(t.imageUrl)}" alt="Twibbon ${esc(t.title)}" loading="lazy">
      <span class="card-badge chip ${t.isSeed ? 'chip-seed' : 'chip-hot'}">${t.isSeed ? '⭐ official' : '🔥 baru'}</span>
      <span class="card-use">Pakai twibbon ini →</span>
    </div>
    <div class="card-body">
      <h3>${esc(t.title)}</h3>
      <div class="card-by">by <b>@${esc(t.author)}</b></div>
      <div class="card-foot">
        <span class="chip chip-time">⏳ ${esc(fmtShort(t.expiresAt))}</span>
        <span class="chip">${days} hari</span>
      </div>
    </div>
  </a>`;
}

function emptyHtml(quota) {
  return `
  <div class="empty" style="grid-column:1/-1">
    <div class="big">🫥</div>
    <h3>Belum ada twibbon tayang</h3>
    <p>Jadilah orang pertama — kuota global masih ${quota.remaining} slot dari ${quota.limit} untuk 14 hari ke depan.</p>
    <a class="btn btn-primary" href="/create">+ Buat Twibbon Pertama</a>
  </div>`;
}

async function render() {
  try {
    const data = await api.list();

    // statistik hero
    qs('#statActive').textContent = data.templates.length;
    qs('#statQuota').innerHTML = `${data.quota.remaining}<small>/${data.quota.limit}</small>`;
    qs('#statGallery').textContent = gallery.all().length;

    if (!data.templates.length) {
      grid.innerHTML = emptyHtml(data.quota);
      return;
    }

    grid.innerHTML = data.templates.map(cardHtml).join('');

    // entrance bertahap
    [...grid.children].forEach((el, i) => {
      setTimeout(() => el.classList.add('in'), 70 * i);
    });

    if (data.quota.remaining <= 0) {
      toast('Kuota global 50 twibbon sudah penuh untuk 14 hari ini.', 'err');
    } else if (data.quota.remaining <= 5) {
      toast(`Sisa kuota tinggal ${data.quota.remaining} slot!`, 'ok');
    }
  } catch (err) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="big">📡</div>
        <h3>Gagal memuat data</h3>
        <p>${esc(err.message)}</p>
        <button class="btn btn-ghost" onclick="location.reload()">Coba lagi</button>
      </div>`;
    toast(err.message, 'err');
  }
}

render();
