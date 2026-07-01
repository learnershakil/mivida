import { NextRequest, NextResponse } from 'next/server'
import { requireMobileUser, AuthError } from '@/lib/auth'
import { buildKey, presignGet, presignPut, isUploadKind } from '@/lib/r2'

// POST /api/m/upload/presign
//   { op: "put", kind, ext, contentType? }  → { putUrl, key }
//   { op: "get", key }                      → { getUrl }
// R2 secret keys never leave the server. Vault bytes are encrypted client-side BEFORE upload.
export async function POST(req: NextRequest) {
  try {
    const user = await requireMobileUser(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const op = body.op ?? 'put'

    if (op === 'get') {
      const key = body.key
      if (typeof key !== 'string' || !key.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: 'Invalid or forbidden key' }, { status: 400 })
      }
      return NextResponse.json({ getUrl: await presignGet(key) })
    }

    if (op === 'put') {
      if (!isUploadKind(body.kind)) {
        return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
      }
      const ext = typeof body.ext === 'string' ? body.ext : 'bin'
      const key = buildKey(user.id, body.kind, ext)
      const putUrl = await presignPut(key, typeof body.contentType === 'string' ? body.contentType : undefined)
      return NextResponse.json({ putUrl, key })
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[presign] error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
