import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { isInvestmentName } from '@/lib/investment'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { id } = await params
  const body = await req.json()

  // Inversión es el grupo especial de ahorro: no se renombra ni se mueve, y nadie más puede llamarse así
  const current = await prisma.category.findFirst({ where: { id, userId }, select: { name: true, parentId: true } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isInv = current.parentId === null && isInvestmentName(current.name)
  if (isInv && ((body.name !== undefined && body.name !== current.name) || body.parentId !== undefined))
    return NextResponse.json({ error: 'La categoría Inversión no se puede renombrar ni mover' }, { status: 400 })
  if (!isInv && body.name !== undefined && isInvestmentName(body.name))
    return NextResponse.json({ error: 'Nombre reservado' }, { status: 400 })

  const updated = await prisma.category.update({
    where: { id, userId },
    data: {
      name: body.name,
      icon: body.icon,
      color: body.color,
      ...(body.parentId !== undefined && { parentId: body.parentId ?? null }),
      ...(body.isFixed !== undefined && { isFixed: body.isFixed }),
    },
    include: { parent: { select: { id: true, name: true, color: true, icon: true } } },
  })

  // Si esta categoría pasa a colgar de un nuevo padre, ese padre deja de ser hoja.
  if (body.parentId) {
    await prisma.transaction.updateMany({ where: { categoryId: body.parentId, userId }, data: { categoryId: null } })
  }

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
  const cat = await prisma.category.findFirst({ where: { id, userId }, select: { name: true, parentId: true } })
  if (cat && cat.parentId === null && isInvestmentName(cat.name))
    return NextResponse.json({ error: 'La categoría Inversión no se puede borrar' }, { status: 400 })
  // Unlink transactions before deleting (only for this user's transactions)
  await prisma.transaction.updateMany({
    where: { categoryId: id, userId },
    data: { categoryId: null },
  })
  await prisma.category.delete({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
