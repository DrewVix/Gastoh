import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { refundedTotal, validateRefund } from '@/lib/refunds'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { id } = await params
  const body = await req.json()
  const { date, amount, description, notes } = body
  let { categoryId, isTransfer } = body

  const current = await prisma.transaction.findFirst({
    where: { id, userId },
    select: { refundOfId: true, refunds: { select: { amount: true } } },
  })
  if (!current) return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })

  if (current.refundOfId) {
    // Devolución: la categoría y el tipo vienen del gasto padre.
    if (amount !== undefined) {
      const check = await validateRefund(userId, current.refundOfId, Number(amount), id)
      if ('error' in check) return NextResponse.json({ error: check.error }, { status: 400 })
    }
    categoryId = undefined
    isTransfer = undefined
  } else if (current.refunds.length > 0) {
    // Gasto con devoluciones: debe seguir siendo un gasto que cubra lo ya devuelto.
    const refunded = refundedTotal(current)
    if (amount !== undefined && (Number(amount) >= 0 || Math.abs(Number(amount)) + 0.005 < refunded)) {
      return NextResponse.json({ error: `El gasto tiene ${refunded.toFixed(2)} € devueltos: su importe no puede ser menor` }, { status: 400 })
    }
    if (isTransfer) {
      return NextResponse.json({ error: 'Un gasto con devoluciones no puede ser una transferencia' }, { status: 400 })
    }
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { _count: { select: { children: true } } } })
    if (category && category._count.children > 0) {
      return NextResponse.json({ error: 'Elige una subcategoría, no se puede asignar una categoría con subcategorías' }, { status: 400 })
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.transaction.update({
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
    }),
    // Las devoluciones siguen la categoría de su gasto.
    ...(categoryId !== undefined
      ? [prisma.transaction.updateMany({ where: { refundOfId: id, userId }, data: { categoryId } })]
      : []),
  ])

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
  // Borrar un gasto borra también sus devoluciones (además del ON DELETE CASCADE).
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { refundOfId: id, userId } }),
    prisma.transaction.delete({ where: { id, userId } }),
  ])
  return NextResponse.json({ ok: true })
}
