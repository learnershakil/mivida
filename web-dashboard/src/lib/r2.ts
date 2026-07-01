// Cloudflare R2 presigning. Secret keys stay here (server env) — never sent to the device.
// See ARCHITECTURE.md §5.
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import { env } from '@/lib/env'

export type UploadKind = 'vault-media' | 'music' | 'album-art' | 'avatar'

const KINDS: readonly UploadKind[] = ['vault-media', 'music', 'album-art', 'avatar']
export function isUploadKind(v: unknown): v is UploadKind {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v)
}

const PRESIGN_TTL_SECONDS = 300 // 5 minutes

let _client: S3Client | null = null
function client(): S3Client {
  if (_client) return _client
  _client = new S3Client({
    region: 'auto',
    endpoint: env.r2Endpoint(),
    credentials: {
      accessKeyId: env.r2AccessKeyId(),
      secretAccessKey: env.r2SecretAccessKey(),
    },
  })
  return _client
}

/** Deterministic-ish key namespaced by user + kind. Caller stores this key on the row. */
export function buildKey(userId: string, kind: UploadKind, ext: string): string {
  const clean = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
  return `${userId}/${kind}/${randomUUID()}.${clean}`
}

export async function presignPut(key: string, contentType?: string): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: env.r2Bucket(), Key: key, ContentType: contentType })
  return getSignedUrl(client(), cmd, { expiresIn: PRESIGN_TTL_SECONDS })
}

export async function presignGet(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: env.r2Bucket(), Key: key })
  return getSignedUrl(client(), cmd, { expiresIn: PRESIGN_TTL_SECONDS })
}
