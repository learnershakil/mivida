/**
 * uploadService — Cloudflare R2 upload/download via backend-issued presigned URLs (ARCHITECTURE §5).
 * R2 secret keys never touch the device; we only ever see short-lived presigned URLs + the object key.
 *
 * Wiring per surface (avatar / music / album-art / vault): after saving the local copy, call
 * uploadToR2(localUri, kind) and persist the returned key on the record (it then syncs). For vault, the
 * bytes MUST be encrypted before upload.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE, getHttpKey } from './apiConfig';

export type UploadKind = 'vault-media' | 'music' | 'album-art' | 'avatar';

const PRESIGN_URL = `${API_BASE}/api/m/upload/presign`;

function extFromUri(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return m ? m[1] : 'bin';
}

/** Upload a local file to R2. Returns the stored object key (persist it on the record → syncs). */
export async function uploadToR2(
  localUri: string,
  kind: UploadKind,
  contentType?: string,
): Promise<string> {
  const httpKey = await getHttpKey();
  if (!httpKey) throw new Error('No sync key configured for upload.');

  // 1) Ask the backend for a presigned PUT URL + key.
  const presignRes = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'x-http-key': httpKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'put', kind, ext: extFromUri(localUri), contentType }),
  });
  if (!presignRes.ok) throw new Error(`Presign failed: ${presignRes.status}`);
  const { putUrl, key } = (await presignRes.json()) as { putUrl: string; key: string };

  // 2) PUT the bytes directly to R2.
  const upload = await FileSystem.uploadAsync(putUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: contentType ? { 'Content-Type': contentType } : {},
  });
  if (upload.status < 200 || upload.status >= 300) {
    throw new Error(`R2 upload failed: ${upload.status}`);
  }
  return key;
}

/** Resolve a short-lived presigned GET URL for a stored key (for display/download). */
export async function getR2DownloadUrl(key: string): Promise<string> {
  const httpKey = await getHttpKey();
  if (!httpKey) throw new Error('No sync key configured for download.');

  const res = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'x-http-key': httpKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'get', key }),
  });
  if (!res.ok) throw new Error(`Presign(get) failed: ${res.status}`);
  const { getUrl } = (await res.json()) as { getUrl: string };
  return getUrl;
}
