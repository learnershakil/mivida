import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWebUser, AuthError } from '@/lib/auth'
import { jsonSafe } from '@/lib/serialize'
import { randomUUID } from 'node:crypto'

export async function GET(req: NextRequest) {
  try {
    const user = await requireWebUser(req)
    const rows = await prisma.contact.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(jsonSafe(rows))
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireWebUser(req)
    const { name, email, phone } = (await req.json().catch(() => ({}))) as {
      name?: string
      email?: string
      phone?: string
    }
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const now = BigInt(Date.now())
    const row = await prisma.contact.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
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
