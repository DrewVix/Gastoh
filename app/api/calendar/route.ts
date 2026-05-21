import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { searchParams } = req.nextUrl
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const ref = new Date(year, month - 1, 1)
  const from = startOfMonth(ref)
  const to = endOfMonth(ref)

  const txs = await prisma.transaction.findMany({
    where: { userId, date: { gte: from, lte: to }, isTransfer: false },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      merchantName: true,
      category: { select: { name: true, color: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Aggregate by day
  const days: Record<string, { expenses: number; income: number; count: number }> = {}
  const txsByDay: Record<string, typeof txs> = {}

  for (const tx of txs) {
    const key = format(tx.date, 'yyyy-MM-dd')
    if (!days[key]) days[key] = { expenses: 0, income: 0, count: 0 }
    if (!txsByDay[key]) txsByDay[key] = []
    days[key].count++
    if (tx.amount < 0) days[key].expenses += Math.abs(tx.amount)
    else days[key].income += tx.amount
    txsByDay[key].push(tx)
  }

  // Round values
  for (const d of Object.values(days)) {
    d.expenses = Math.round(d.expenses * 100) / 100
    d.income = Math.round(d.income * 100) / 100
  }

  return NextResponse.json({ year, month, days, txsByDay })
}
