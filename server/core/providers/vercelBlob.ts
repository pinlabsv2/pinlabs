import { ProviderError, type ReviewImageStorage, type StoredObject } from './types.js';

const objectPath = (key: string) => key.split('/').map(encodeURIComponent).join('/');

export class VercelBlobStorage implements ReviewImageStorage {
  private readonly token: string;
  private readonly apiUrl: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.token = env.BLOB_READ_WRITE_TOKEN || '';
    this.apiUrl = (env.VERCEL_BLOB_API_URL || 'https://blob.vercel-storage.com').replace(/\/$/, '');
  }

  private authHeaders(extra: Record<string, string> = {}) {
    if (!this.token) throw new ProviderError('Vercel Blob token is not configured', 'not_configured');
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  async putObject(key: string, bytes: Uint8Array, contentType: string): Promise<StoredObject> {
    const response = await fetch(`${this.apiUrl}/${objectPath(key)}`, {
      method: 'PUT',
      headers: this.authHeaders({ 'x-content-type': contentType, 'x-add-random-suffix': '0' }),
      body: Buffer.from(bytes),
    });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new ProviderError(String(raw.message || `Blob upload failed (${response.status})`), 'provider_error', response.status, response.status >= 500);
    const url = String(raw.url || '');
    if (!url) throw new ProviderError('Blob upload returned no URL', 'invalid_response');
    return { key: String(raw.pathname || key), url, downloadUrl: raw.downloadUrl ? String(raw.downloadUrl) : undefined, contentType, size: bytes.byteLength };
  }

  async readObject(object: StoredObject): Promise<Uint8Array> {
    const response = await fetch(object.downloadUrl || object.url, { headers: this.authHeaders() });
    if (!response.ok) throw new ProviderError(`Blob read failed (${response.status})`, 'provider_error', response.status, response.status >= 500);
    return new Uint8Array(await response.arrayBuffer());
  }

  async deleteObject(object: StoredObject): Promise<void> {
    const response = await fetch(this.apiUrl, {
      method: 'DELETE',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ urls: [object.url] }),
    });
    if (!response.ok && response.status !== 404) throw new ProviderError(`Blob delete failed (${response.status})`, 'provider_error', response.status, response.status >= 500);
  }
}
