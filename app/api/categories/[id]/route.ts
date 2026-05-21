import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { id } = await params
  const body = await req.json()
  const updated = await prisma.category.update({
    where: { id, userId },
    data: {
      name: body.name,
      icon: body.icon,
      color: body.color,
      ...(body.parentId !== undefined && { parentId: body.parentId ?? null }),
    },
    include: { parent: { select: { id: true, name: true, color: true, icon: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { id } = await params
  // Unlink transactions before deleting (only for this user's transactions)
  await prisma.transaction.updateMany({
    where: { categoryId: id, userId },
    data: { categoryId: null },
  })
  await prisma.category.delete({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
