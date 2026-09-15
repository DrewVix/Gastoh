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
      },
      orderBy: sortBy === 'amount' ? [{ amount: sortDir }] : [{ date: sortDir }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({ transactions, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const body = await req.json()
  const { date, amount, description, categoryId, notes, isTransfer, currency } = body

  if (!date || amount === undefined || !description) {
    return NextResponse.json({ error: 'date, amount y description son requeridos' }, { status: 400 })
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
      isTransfer: Boolean(isTransfer),
      isManual: true,
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true, parentId: true, isFixed: true, parent: { select: { id: true, name: true, color: true, icon: true } } } },
    },
  })

  return NextResponse.json(tx, { status: 201 })
}
