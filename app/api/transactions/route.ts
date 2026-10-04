import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { notRefund, refundedTotal, validateRefund } from '@/lib/refunds'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { searchParams } = req.nextUrl
  const month = searchParams.get('month') // "YYYY-MM"
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const categoryId = searchParams.get('category')
  const q = searchParams.get('q')
  const type = searchParams.get('type') // 'gasto' | 'ingreso' | 'transferencia' | null (todos)
  const fixed = searchParams.get('fixed') // 'fixed' | 'variable' | null (todos)
  const minAmount = searchParams.get('minAmount')
  const maxAmount = searchParams.get('maxAmount')
  const sortBy = searchParams.get('sortBy') === 'amount' ? 'amount' : 'date'
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  // Las devoluciones no se listan sueltas: van anidadas en su gasto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { userId, ...notRefund }

  if (fromParam && toParam) {
    where.date = {
      gte: new Date(fromParam),
      lte: new Date(toParam + 'T23:59:59'),
    }
  } else if (month) {
    const [y, m] = month.split('-').map(Number)
    where.date = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    }
  }

  if (categoryId) where.categoryId = categoryId === 'none' ? null : categoryId

  // Tipo: por defecto (sin filtro) se excluyen las transferencias, igual que antes.
  if (type === 'transferencia') {
    where.isTransfer = true
  } else {
    where.isTransfer = false
    if (type === 'gasto') where.amount = { lt: 0 }
    else if (type === 'ingreso') where.amount = { gt: 0 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const and: any[] = []

  if (q) {
    and.push({ description: { contains: q } })
  }

  // Fijo/variable: se marca por categoría (subcategoría o grupo), sin herencia.
  if (fixed === 'fixed') where.category = { isFixed: true }
  else if (fixed === 'variable') and.push({ OR: [{ categoryId: null }, { category: { isFixed: false } }] })

  // Rango de importe: se compara por magnitud (valor absoluto), sea gasto o ingreso.
  const min = minAmount ? Math.abs(parseFloat(minAmount)) : null
  const max = maxAmount ? Math.abs(parseFloat(maxAmount)) : null
  if (min != null || max != null) {
    and.push({
      OR: [
        { amount: { ...(min != null && { gte: min }), ...(max != null && { lte: max }) } },
        { amount: { ...(max != null && { gte: -max }), ...(min != null && { lte: -min }) } },
      ],
    })
  }

  if (and.length) where.AND = and

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, parentId: true, isFixed: true, parent: { select: { id: true, name: true, color: true, icon: true } } } },
        refunds: { select: { id: true, date: true, amount: true, description: true, notes: true }, orderBy: { date: 'asc' } },
      },
      orderBy: sortBy === 'amount' ? [{ amount: sortDir }] : [{ date: sortDir }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({
    transactions: transactions.map((t) => ({ ...t, refunded: refundedTotal(t) })),
    total, page, limit,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const body = await req.json()
  const { date, amount, description, notes, isTransfer, currency, refundOfId } = body
  let { categoryId } = body

  if (!date || amount === undefined || !description) {
    return NextResponse.json({ error: 'date, amount y description son requeridos' }, { status: 400 })
  }

  // Devolución: hereda la categoría del gasto y nunca es transferencia.
  if (refundOfId) {
    const check = await validateRefund(userId, String(refundOfId), Number(amount))
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: 400 })
    categoryId = check.parent.categoryId
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { _count: { select: { children: true } } } })
    if (category && category._count.children > 0) {
      return NextResponse.json({ error: 'Elige una subcategoría, no se puede asignar una categoría con subcategorías' }, { status: 400 })
    }
  }

  const tx = await prisma.transaction.create({
    data: {
      userId,
      externalId: `manual_${crypto.randomUUID()}`,
      date: new Date(date),
      amount: Number(amount),
      currency: currency ?? 'EUR',
      description: String(description),
      categoryId: categoryId ?? null,
      notes: notes ? String(notes) : null,
      isTransfer: refundOfId ? false : Boolean(isTransfer),
      refundOfId: refundOfId ? String(refundOfId) : null,
      isManual: true,
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true, parentId: true, isFixed: true, parent: { select: { id: true, name: true, color: true, icon: true } } } },
    },
  })

  return NextResponse.json(tx, { status: 201 })
}
