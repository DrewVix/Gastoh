import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { searchParams } = req.nextUrl
  const month = searchParams.get('month') // "YYYY-MM"
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const categoryId = searchParams.get('category')
  const merchant = searchParams.get('merchant')
  const q = searchParams.get('q')
  const type = searchParams.get('type') // 'gasto' | 'ingreso' | 'transferencia' | null (todos)
  const fixed = searchParams.get('fixed') // 'fixed' | 'variable' | null (todos)
  const minAmount = searchParams.get('minAmount')
  const maxAmount = searchParams.get('maxAmount')
  const sortBy = searchParams.get('sortBy') === 'amount' ? 'amount' : 'date'
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { userId }

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

  if (merchant) where.merchantName = merchant

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
    and.push({ OR: [{ description: { contains: q } }, { merchantName: { contains: q } }] })
  }

  // Fijo/variable: hereda de la categoría o de su grupo padre.
  if (fixed === 'fixed' || fixed === 'variable') {
    const isFixedCondition = { OR: [{ category: { isFixed: true } }, { category: { parent: { isFixed: true } } }] }
    and.push(fixed === 'fixed' ? isFixedCondition : { NOT: isFixedCondition })
  }

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

  const [transactions, total, merchantSum] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, parentId: true, isFixed: true, parent: { select: { id: true, name: true, color: true, icon: true, isFixed: true } } } },
      },
      orderBy: sortBy === 'amount' ? [{ amount: sortDir }] : [{ date: sortDir }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
    merchant
      ? prisma.transaction.aggregate({ where, _sum: { amount: true } })
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    transactions,
    total,
    page,
    limit,
    ...(merchantSum && { merchantTotal: merchantSum._sum.amount ?? 0 }),
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const body = await req.json()
  const { date, amount, description, merchantName, categoryId, notes, isTransfer, currency } = body

  if (!date || amount === undefined || !description) {
    return NextResponse.json({ error: 'date, amount y description son requeridos' }, { status: 400 })
  }

  const tx = await prisma.transaction.create({
    data: {
      userId,
      externalId: `manual_${crypto.randomUUID()}`,
      date: new Date(date),
      amount: Number(amount),
      currency: currency ?? 'EUR',
      description: String(description),
      merchantName: merchantName ? String(merchantName) : null,
      categoryId: categoryId ?? null,
      notes: notes ? String(notes) : null,
      isTransfer: Boolean(isTransfer),
      isManual: true,
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true, parentId: true, isFixed: true, parent: { select: { id: true, name: true, color: true, icon: true, isFixed: true } } } },
    },
  })

  return NextResponse.json(tx, { status: 201 })
}
