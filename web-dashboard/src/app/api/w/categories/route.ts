import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWebUser, AuthError } from '@/lib/auth'
import { jsonSafe } from '@/lib/serialize'
import { randomUUID } from 'node:crypto'

// GET /api/w/categories → the user's non-deleted categories
export async function GET(req: NextRequest) {
  try {
    const user = await requireWebUser(req)
    const rows = await prisma.category.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(jsonSafe(rows))
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/w/categories { name, color? } → create (source='web'); syncs to the device
export async function POST(req: NextRequest) {
  try {
    const user = await requireWebUser(req)
    const { name, color } = (await req.json().catch(() => ({}))) as { name?: string; color?: string }
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const now = BigInt(Date.now())
    const row = await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: name.trim() } },
      update: { deletedAt: null, color: color ?? undefined, updatedAt: now },
      create: {
        id: randomUUID(),
        userId: user.id,
        name: name.trim(),
        color: color ?? null,
        source: 'web',
        createdAt: now,
        updatedAt: now,
      },
    })
    return NextResponse.json(jsonSafe(row), { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
