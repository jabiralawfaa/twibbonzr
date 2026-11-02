import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { put, del } from '@vercel/blob';
import { UPLOAD_DIR } from './config.js';

/** true bila imageName berisi URL (Vercel Blob), bukan nama file lokal. */
export const isRemoteUrl = (name) => /^https?:\/\//i.test(String(name || ''));

/**
 * Pakai Vercel Blob bila sedang jalan di Vercel ATAU token sudah di-pull ke lokal.
 * Di mesin lokal tanpa token → tulis ke data/uploads/ seperti biasa.
 */
export const useBlob = () =>
  Boolean(process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);

/**
 * Simpan PNG template. Mengembalikan nilai yang disimpan ke kolom `imageName`:
 * URL Blob (mode remote) atau nama file (mode lokal).
 */
export async function saveTemplate(name, buf) {
  if (useBlob()) {
    const blob = await put(`templates/${name}`, buf, {
      access: 'public', // store harus dibuat dengan akses public
      contentType: 'image/png',
      allowOverwrite: false,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  mkdirSync(UPLOAD_DIR, { recursive: true });
  writeFileSync(join(UPLOAD_DIR, name), buf);
  return name;
}

/** Hapus file template (Blob URL maupun file lokal). Tidak melempar error. */
export async function removeTemplate(name) {
  if (!name) return;
  if (isRemoteUrl(name)) {
    try {
      await del(name);
    } catch {
      /* blob mungkin sudah hilang */
    }
    return;
  }
  try {
    unlinkSync(join(UPLOAD_DIR, name));
  } catch {
    /* file mungkin sudah dihapus */
  }
}
