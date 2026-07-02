import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getWebSessionUser } from '@/lib/auth'
import { getAuthUrl } from '@/lib/google'

// GET /api/w/google/oauth/start → redirect to Google consent (session-gated).
export async function GET() {
  const user = await getWebSessionUser()
  if (!user) redirect('/login')
  return NextResponse.redirect(getAuthUrl(user.id))
}
