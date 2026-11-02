import { useState } from 'react';
import { uploadFile } from './api';

const toBase64 = (f: File) => new Promise<string>((ok, fail) => {
  const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = fail; r.readAsDataURL(f);
});

/** Uploads a file to the database-backed file store. Returns a permanent URL. */
export function useUpload() {
  const [isUploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) throw new Error('File too large (max 4 MB).');
    setUploading(true);
    try { return await uploadFile({ filename: file.name, mimeType: file.type, dataBase64: await toBase64(file) }); }
    finally { setUploading(false); }
  };
  return { upload, isUploading };
}
