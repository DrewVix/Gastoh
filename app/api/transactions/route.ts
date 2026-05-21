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
  const bank = searchParams.get('bank')
  const merchant = searchParams.get('merchant')
  const q = searchParams.get('q')
  const excludeTransfers = searchParams.get('excludeTransfers') === '1'
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

  if (bank) {
    where.bankAccount = { bank }
  }

  if (q) {
    where.OR = [
      { description: { contains: q } },
      { merchantName: { contains: q } },
    ]
  }

  if (merchant) where.merchantName = merchant

  if (excludeTransfers) where.isTransfer = false

  const [transactions, total, merchantSum] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, parentId: true, parent: { select: { id: true, name: true, color: true, icon: true } } } },
        bankAccount: { select: { bank: true, displayName: true } },
      },
      orderBy: { date: 'desc' },
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
      bankAccountId: null,
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true, parentId: true, parent: { select: { id: true, name: true, color: true, icon: true } } } },
      bankAccount: { select: { bank: true, displayName: true } },
    },
  })

  return NextResponse.json(tx, { status: 201 })
}
