import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import {
  startOfMonth, endOfMonth, endOfDay,
  subMonths, subDays, format, differenceInDays,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { applyRules, type MerchantRule } from '@/lib/merchant-rules'

async function getPeriodData(from: Date, to: Date, userId: string, merchantRules: MerchantRule[] = []) {
  const txs = await prisma.transaction.findMany({
    where: { userId, date: { gte: from, lte: to }, isTransfer: false },
    include: {
      category: { select: { id: true, name: true, color: true } },
      bankAccount: { select: { bank: true, displayName: true } },
    },
    orderBy: { amount: 'asc' },
  })

  const expenses = txs.filter((t) => t.amount < 0)
  const income = txs.filter((t) => t.amount > 0)
  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const days = Math.max(1, differenceInDays(to, from) + 1)

  const categoryMap = new Map<string, { id: string | null; name: string; color: string; total: number; count: number }>()
  for (const tx of expenses) {
    const key = tx.categoryId ?? '__none'
    const cur = categoryMap.get(key)
    if (cur) { cur.total += Math.abs(tx.amount); cur.count++ }
    else categoryMap.set(key, { id: tx.categoryId, name: tx.category?.name ?? 'Sin categoría', color: tx.category?.color ?? '#6b7280', total: Math.abs(tx.amount), count: 1 })
  }
  const byCategory = Array.from(categoryMap.values())
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ ...c, pct: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0 }))

  const sourceMap = new Map<string, { source: string; label: string; total: number; count: number }>()
  for (const tx of expenses) {
    const key = tx.bankAccount?.bank ?? 'MANUAL'
    const label = tx.bankAccount?.displayName ?? 'Importado'
    const cur = sourceMap.get(key)
    if (cur) { cur.total += Math.abs(tx.amount); cur.count++ }
    else sourceMap.set(key, { source: key, label, total: Math.abs(tx.amount), count: 1 })
  }

  const topTransactions = expenses.slice(0, 10).map((tx) => ({
    id: tx.id,
    date: format(tx.date, 'dd MMM'),
    description: tx.description,
    amount: tx.amount,
    category: tx.category?.name ?? 'Sin categoría',
    categoryColor: tx.category?.color ?? '#6b7280',
  }))

  const merchantMap = new Map<string, { name: string; total: number; count: number; categoryColor: string; categoryName: string }>()
  for (const tx of expenses) {
    const raw = (tx.merchantName || tx.description).trim()
    const key = applyRules(raw, merchantRules)
    const cur = merchantMap.get(key)
    if (cur) { cur.total += Math.abs(tx.amount); cur.count++ }
    else merchantMap.set(key, { name: key, total: Math.abs(tx.amount), count: 1, categoryColor: tx.category?.color ?? '#6b7280', categoryName: tx.category?.name ?? 'Sin categoría' })
  }
  const topMerchants = Array.from(merchantMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

  return {
    summary: {
      totalExpenses,
      totalIncome,
      netFlow: totalIncome - totalExpenses,
      transactionCount: txs.length,
      expenseCount: expenses.length,
      avgPerDay: totalExpenses / days,
    },
    byCategory,
    bySource: Array.from(sourceMap.values()),
    topTransactions,
    topMerchants,
    days,
  }
}

function linearTrend(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  return den === 0 ? 0 : num / den
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { searchParams } = req.nextUrl
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const now = new Date()
  const from = fromParam ? new Date(fromParam) : startOfMonth(now)
  const to = toParam ? endOfDay(new Date(toParam)) : endOfMonth(now)

  const periodDays = differenceInDays(to, from) + 1
  const prevTo = subDays(from, 1)
  const prevFrom = subDays(from, periodDays - 1)

  // Desplazamiento de ingresos: cobro del mes anterior se cuenta como ingreso de este mes
  const shiftIncome = searchParams.get('shiftIncome') === '1'
  const incomePrevMonth = subMonths(from, 1)
  const incomeFrom = shiftIncome ? startOfMonth(incomePrevMonth) : from
  const incomeTo   = shiftIncome ? endOfMonth(incomePrevMonth) : to
  const incomePeriodLabel = shiftIncome ? format(incomePrevMonth, 'MMMM yyyy', { locale: es }) : null

  const baselineFrom = startOfMonth(subMonths(now, 3))
  const baselineTo = endOfMonth(subMonths(now, 1))
  const baselineDays = Math.max(1, differenceInDays(baselineTo, baselineFrom) + 1)

  // Last 12 months start for record detection
  const yearStart = startOfMonth(subMonths(now, 11))
  // Last 3 months start for recurring detection
  const recurringStart = startOfMonth(subMonths(now, 3))

  const merchantRules = await prisma.merchantRule.findMany({
    where: { userId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })

  const [current, prev, shiftedIncomeTxs, trendData, baselineTxs, yearCatTxs, recurringTxs] = await Promise.all([
    getPeriodData(from, to, userId, merchantRules),
    getPeriodData(prevFrom, prevTo, userId),
    // Ingresos del mes anterior (nómina llega antes de que empiece el mes)
    shiftIncome
      ? prisma.transaction.findMany({
          where: { userId, date: { gte: incomeFrom, lte: incomeTo }, amount: { gt: 0 }, isTransfer: false },
          select: { amount: true },
        })
      : Promise.resolve(null),
    Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const d = subMonths(now, 11 - i)
        const mFrom = startOfMonth(d)
        const mTo = endOfMonth(d)
        return prisma.transaction
          .findMany({ where: { userId, date: { gte: mFrom, lte: mTo }, isTransfer: false }, select: { amount: true } })
          .then((txs) => ({
            month: format(d, 'MMM yy'),
            expenses: txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
            income: txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
          }))
      })
    ),
    prisma.transaction.findMany({
      where: { userId, date: { gte: baselineFrom, lte: baselineTo }, amount: { lt: 0 }, isTransfer: false },
      select: { amount: true, categoryId: true, category: { select: { name: true, color: true } } },
    }),
    // Per-category monthly totals for last 12 months (record detection)
    prisma.transaction.findMany({
      where: { userId, date: { gte: yearStart, lte: now }, amount: { lt: 0 }, isTransfer: false },
      select: { amount: true, categoryId: true, date: true },
    }),
    // Recent 3 months for recurring expense detection
    prisma.transaction.findMany({
      where: { userId, date: { gte: recurringStart }, amount: { lt: 0 }, isTransfer: false },
      select: { amount: true, description: true, merchantName: true, date: true, category: { select: { name: true, color: true } } },
    }),
  ])

  // ── Baseline per-day-rate by category ──
  const baselineCatMap = new Map<string, { name: string; color: string; perDay: number }>()
  for (const tx of baselineTxs) {
    const key = tx.categoryId ?? '__none'
    const perDay = Math.abs(tx.amount) / baselineDays
    const cur = baselineCatMap.get(key)
    if (cur) cur.perDay += perDay
    else baselineCatMap.set(key, { name: tx.category?.name ?? 'Sin categoría', color: tx.category?.color ?? '#6b7280', perDay })
  }

  // ── Previous period category totals ──
  const prevCatMap = new Map<string, number>()
  for (const cat of prev.byCategory) prevCatMap.set(cat.id ?? '__none', cat.total)

  // ── Record detection: flag category if current month is highest in 12 months ──
  const catMonthMap = new Map<string, Map<string, number>>()
  for (const tx of yearCatTxs) {
    const catKey = tx.categoryId ?? '__none'
    const monthKey = format(tx.date, 'yyyy-MM')
    if (!catMonthMap.has(catKey)) catMonthMap.set(catKey, new Map())
    const mm = catMonthMap.get(catKey)!
    mm.set(monthKey, (mm.get(monthKey) ?? 0) + Math.abs(tx.amount))
  }
  const currentMonthKey = format(from, 'yyyy-MM')
  const recordMap = new Map<string, boolean>()
  for (const [catKey, monthMap] of catMonthMap) {
    if (monthMap.size < 2) continue
    const currentTotal = monthMap.get(currentMonthKey) ?? 0
    if (currentTotal === 0) continue
    const maxPrev = Math.max(...Array.from(monthMap.entries()).filter(([m]) => m !== currentMonthKey).map(([, v]) => v))
    recordMap.set(catKey, currentTotal > maxPrev)
  }

  // ── Recurring expense detection ──
  const merchantMonthsMap = new Map<string, Set<string>>()
  const merchantMeta = new Map<string, { amounts: number[]; catName: string; catColor: string }>()
  for (const tx of recurringTxs) {
    const raw = (tx.merchantName || tx.description).trim()
    const key = applyRules(raw, merchantRules)
    const monthKey = format(tx.date, 'yyyy-MM')
    if (!merchantMonthsMap.has(key)) merchantMonthsMap.set(key, new Set())
    merchantMonthsMap.get(key)!.add(monthKey)
    if (!merchantMeta.has(key)) merchantMeta.set(key, { amounts: [], catName: tx.category?.name ?? 'Sin categoría', catColor: tx.category?.color ?? '#6b7280' })
    merchantMeta.get(key)!.amounts.push(Math.abs(tx.amount))
  }
  const recurring = Array.from(merchantMonthsMap.entries())
    .filter(([, months]) => months.size >= 2)
    .map(([name, months]) => {
      const meta = merchantMeta.get(name)!
      const avg = meta.amounts.reduce((s, v) => s + v, 0) / meta.amounts.length
      return { name, monthlyAmount: Math.round(avg * 100) / 100, monthCount: months.size, categoryName: meta.catName, categoryColor: meta.catColor }
    })
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
    .slice(0, 15)

  const recurringTotal = recurring.reduce((s, r) => s + r.monthlyAmount, 0)

  // ── Assemble byCategory with all enrichments ──
  const periodDaysNum = current.days
  const byCategory = current.byCategory.map((cat) => {
    const key = cat.id ?? '__none'
    const baseline = baselineCatMap.get(key)
    const currentPerDay = cat.total / periodDaysNum
    const baselineMonthly = baseline ? Math.round(baseline.perDay * 30) : null
    const trend = baseline && baseline.perDay > 0
      ? Math.round(((currentPerDay - baseline.perDay) / baseline.perDay) * 100)
      : null
    const prevTotal = prevCatMap.get(key) ?? null
    const isRecord = recordMap.get(key) ?? false
    return { ...cat, trend, baselineMonthly, prevTotal, isRecord }
  })

  // ── Spending trend ──
  const last6 = trendData.slice(-6).map((m) => m.expenses)
  const trendSlope = linearTrend(last6)
  const avgLast6 = last6.reduce((s, v) => s + v, 0) / Math.max(1, last6.filter(v => v > 0).length)
  const overallTrendPct = avgLast6 > 0 ? Math.round((trendSlope / avgLast6) * 100) : 0

  // ── Savings insights ──
  const insights = byCategory
    .filter((c) => c.trend !== null && c.trend > 5 && c.total > 0)
    .sort((a, b) => (b.pct * Math.abs(b.trend ?? 0)) - (a.pct * Math.abs(a.trend ?? 0)))
    .slice(0, 5)
    .map((c) => ({ name: c.name, color: c.color, total: c.total, pct: c.pct, trend: c.trend, baselineMonthly: c.baselineMonthly }))

  // ── Monthly projection ──
  let projection = null
  if (from <= now && to >= now) {
    const daysElapsed = Math.max(1, differenceInDays(now, from) + 1)
    const totalDays = differenceInDays(to, from) + 1
    const dailyRate = current.summary.totalExpenses / daysElapsed
    projection = { projected: Math.round(dailyRate * totalDays * 100) / 100, daysElapsed, totalDays, pctComplete: Math.round((daysElapsed / totalDays) * 100) }
  }

  // ── Ingresos desplazados: sustituir los del periodo por los del mes anterior ──
  let finalIncome = current.summary.totalIncome
  if (shiftIncome && shiftedIncomeTxs) {
    finalIncome = shiftedIncomeTxs.reduce((s, t) => s + t.amount, 0)
  }
  const finalNetFlow = finalIncome - current.summary.totalExpenses

  // ── Agrupar byCategory por padre ──────────────────────────────────────────
  // Obtenemos parentId para cada categoría del periodo
  const catIds = byCategory.map(c => c.id).filter(Boolean) as string[]
  const catMeta = catIds.length > 0
    ? await prisma.category.findMany({
        where: { id: { in: catIds } },
        select: { id: true, parentId: true, isFixed: true, parent: { select: { id: true, name: true, color: true, icon: true, isFixed: true } } },
      })
    : []
  const catParentMap = new Map(catMeta.map(c => [c.id, c.parent]))
  const catIsFixedMap = new Map(catMeta.map(c => [c.id, c.isFixed || (c.parent?.isFixed ?? false)]))

  const groupMap = new Map<string, { id: string; name: string; color: string; icon: string | null; isFixed: boolean; total: number; pct: number; subcategories: typeof byCategory }>()
  const ungroupedCats: typeof byCategory = []

  for (const cat of byCategory) {
    const parent = cat.id ? catParentMap.get(cat.id) : null
    if (parent) {
      const existing = groupMap.get(parent.id)
      if (existing) {
        existing.total += cat.total
        existing.subcategories.push(cat)
      } else {
        groupMap.set(parent.id, { id: parent.id, name: parent.name, color: parent.color ?? '#6b7280', icon: parent.icon ?? null, isFixed: (parent as { isFixed?: boolean }).isFixed ?? false, total: cat.total, pct: 0, subcategories: [cat] })
      }
    } else {
      ungroupedCats.push(cat)
    }
  }

  const totalExp = current.summary.totalExpenses
  const byGroup = [
    ...Array.from(groupMap.values()).map(g => ({
      ...g,
      pct: totalExp > 0 ? (g.total / totalExp) * 100 : 0,
      subcategories: g.subcategories.sort((a, b) => b.total - a.total),
    })),
    ...ungroupedCats.map(c => ({
      id: c.id ?? '__none',
      name: c.name,
      color: c.color,
      icon: null,
      isFixed: c.id ? (catIsFixedMap.get(c.id) ?? false) : false,
      total: c.total,
      pct: c.pct,
      subcategories: [] as typeof byCategory,
    })),
  ].sort((a, b) => b.total - a.total)

  // ── Fixed vs variable breakdown ──
  const fixedTotal = byGroup.filter(g => g.isFixed).reduce((s, g) => s + g.total, 0)
  const variableTotal = current.summary.totalExpenses - fixedTotal
  const fixedBreakdown = byGroup.filter(g => g.isFixed)
  const variableBreakdown = byGroup.filter(g => !g.isFixed)

  // ── Savings rate ──
  const savingsRate = finalIncome > 0
    ? Math.round((finalNetFlow / finalIncome) * 100)
    : null

  return NextResponse.json({
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
    periodDays,
    incomeShifted: shiftIncome,
    incomePeriodLabel,
    summary: {
      ...current.summary,
      totalIncome: finalIncome,
      netFlow: finalNetFlow,
      savingsRate,
      prev: prev.summary,
    },
    byCategory,
    bySource: current.bySource,
    topTransactions: current.topTransactions,
    topMerchants: current.topMerchants,
    trend: trendData,
    insights,
    projection,
    overallTrendPct,
    byGroup,
    fixedTotal: Math.round(fixedTotal * 100) / 100,
    variableTotal: Math.round(variableTotal * 100) / 100,
    fixedBreakdown,
    variableBreakdown,
    recurring,
    recurringTotal: Math.round(recurringTotal * 100) / 100,
  })
}
