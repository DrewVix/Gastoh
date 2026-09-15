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
  const { date, amount, description, categoryId, notes, isTransfer } = body

  const updated = await prisma.transaction.update({
    where: { id, userId },
    data: {
      ...(date !== undefined && { date: new Date(date) }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(description !== undefined && { description: String(description) }),
      ...(categoryId !== undefined && { categoryId, isManual: true }),
      ...(notes !== undefined && { notes }),
      ...(isTransfer !== undefined && { isTransfer }),
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
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
  await prisma.transaction.delete({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
