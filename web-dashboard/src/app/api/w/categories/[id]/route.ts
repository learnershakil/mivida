import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWebUser, AuthError } from '@/lib/auth'

// DELETE /api/w/categories/:id → soft-delete (syncs to the device)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireWebUser(req)
    const { id } = await ctx.params
    await prisma.category.updateMany({
      where: { id, userId: user.id },
      data: { deletedAt: BigInt(Date.now()), updatedAt: BigInt(Date.now()) },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
