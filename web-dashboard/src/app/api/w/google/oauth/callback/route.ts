import { NextRequest, NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getWebSessionUser } from '@/lib/auth'
import { exchangeCode, storeTokens } from '@/lib/google'

// GET /api/w/google/oauth/callback?code=... → exchange + store encrypted tokens, then back to the dashboard.
export async function GET(req: NextRequest) {
  const user = await getWebSessionUser()
  if (!user) redirect('/login')

  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')
  if (error) return NextResponse.redirect(new URL(`/?google=${encodeURIComponent(error)}`, req.url))
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  try {
    const tokens = await exchangeCode(code)
    await storeTokens(user.id, tokens)
    return NextResponse.redirect(new URL('/?google=connected', req.url))
  } catch (err) {
    console.error('[google callback] error', err)
    return NextResponse.redirect(new URL('/?google=error', req.url))
  }
}
