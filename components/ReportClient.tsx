'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet, PiggyBank, RefreshCw } from 'lucide-react'
import {
  format, parse, startOfMonth, endOfMonth, subMonths, addMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Skeleton from './Skeleton'

interface GroupRow {
  id: string
  name: string
  color: string
  icon: string | null
  total: number
  pct: number
  isFixed: boolean
  subcategories?: { id: string; name: string; color: string; total: number; pct: number }[]
}

interface ReportData {
  summary: {
    totalExpenses: number
    totalIncome: number
    netFlow: number
    savingsRate: number | null
    totalInvested: number
    investedBuys: number
    investedSales: number
    netLiquidity: number
    prev: { totalExpenses: number }
  }
  investmentBreakdown: { id: string; name: string; color: string; total: number }[]
  fixedTotal: number
  variableTotal: number
  fixedBreakdown: GroupRow[]
  variableBreakdown: GroupRow[]
  recurring: {
    name: string
    monthlyAmount: number
    monthCount: number
    categoryName: string
    categoryColor: string
  }[]
  recurringTotal: number
  trend: { month: string; expenses: number; income: number; invested: number }[]
}

const eur = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function BreakdownPanel({
  title,
  total,
  totalExpenses,
  rows,
  emptyHint,
}: {
  title: string
  total: number
  totalExpenses: number
  rows: GroupRow[]
  emptyHint?: string
}) {
  const pctOfTotal = totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {title}
        </span>
        <span className="text-lg font-bold flex-shrink-0" style={{ color: 'var(--foreground)' }}>
          {eur(total)}
        </span>
      </div>

      {rows.length === 0 && emptyHint ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>
          {emptyHint}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: row.color }}
                  />
                  <span className="text-sm truncate" style={{ color: 'var(--foreground)' }}>
                    {row.name}
                  </span>
                </div>
                <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--foreground)' }}>
                  {eur(row.total)}
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${Math.min(100, row.pct)}%`, background: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs pt-1" style={{ color: 'var(--muted)', borderTop: '1px solid var(--card-border)' }}>
        {pctOfTotal}% del gasto total
      </div>
    </div>
  )
}

export default function ReportClient() {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(format(today, 'yyyy-MM'))
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(
    async (month: string) => {
      setLoading(true)
      try {
        const date = parse(month, 'yyyy-MM', new Date())
        const from = format(startOfMonth(date), 'yyyy-MM-dd')
        const to = format(endOfMonth(date), 'yyyy-MM-dd')
        const res = await fetch(`/api/dashboard?from=${from}&to=${to}`)
        if (res.ok) {
          const json = await res.json()
          setData(json as ReportData)
        }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchData(currentMonth)
  }, [currentMonth, fetchData])

  function prevMonth() {
    const date = parse(currentMonth, 'yyyy-MM', new Date())
    setCurrentMonth(format(subMonths(date, 1), 'yyyy-MM'))
  }

  function nextMonth() {
    const date = parse(currentMonth, 'yyyy-MM', new Date())
    setCurrentMonth(format(addMonths(date, 1), 'yyyy-MM'))
  }

  const isCurrentMonth = currentMonth === format(today, 'yyyy-MM')

  const monthLabel = format(
    parse(currentMonth, 'yyyy-MM', new Date()),
    'MMMM yyyy',
    { locale: es }
  )

  // Build trend chart data with fixed/variable split estimate
  const trendChartData = data
    ? data.trend.slice(-6).map((m) => {
        const fixedRatio =
          data.summary.totalExpenses > 0
            ? data.fixedTotal / data.summary.totalExpenses
            : 0
        const fixedPart = Math.round(m.expenses * fixedRatio)
        const variablePart = m.expenses - fixedPart
        return {
          month: m.month,
          Fijo: fixedPart,
          Variable: variablePart,
          Invertido: Math.round(m.invested),
        }
      })
    : []

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Informe Mensual</h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: 'var(--muted)' }}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-semibold capitalize w-40 text-center" style={{ color: 'var(--foreground)' }}>
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--muted)' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="card p-4 space-y-3">
                <Skeleton className="h-3 w-24" />
                {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard
              label="Gastos totales"
              value={eur(data.summary.totalExpenses)}
              sub={
                data.summary.prev.totalExpenses > 0
                  ? `vs ${eur(data.summary.prev.totalExpenses)} mes ant.`
                  : undefined
              }
            />
            <KpiCard
              label="Ingresos"
              value={eur(data.summary.totalIncome)}
            />
            <KpiCard
              label="Ahorro neto"
              value={eur(data.summary.netFlow)}
            />
            <KpiCard
              label="Tasa ahorro"
              value={
                data.summary.savingsRate !== null
                  ? `${data.summary.savingsRate}%`
                  : '—'
              }
            />
            <KpiCard
              label="Invertido"
              value={eur(data.summary.totalInvested)}
              sub={
                data.summary.investedSales > 0
                  ? `compras ${eur(data.summary.investedBuys)} · ventas −${eur(data.summary.investedSales)}`
                  : undefined
              }
            />
            <KpiCard
              label="Liquidez neta"
              value={eur(data.summary.netLiquidity)}
              sub="ingresos − gastos − invertido"
            />
          </div>

          {/* Inversión por destino */}
          {data.investmentBreakdown.length > 0 && (
            <div className="card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                  Inversión por destino
                </span>
                <span className="text-lg font-bold flex-shrink-0" style={{ color: 'var(--foreground)' }}>
                  {eur(data.summary.totalInvested)}
                </span>
              </div>
              <div className="divide-y divide-[var(--card-border)]">
                {data.investmentBreakdown.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
                      <span className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{row.name}</span>
                    </div>
                    <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--foreground)' }}>
                      {eur(row.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fixed vs Variable */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <BreakdownPanel
              title="Gastos fijos"
              total={data.fixedTotal}
              totalExpenses={data.summary.totalExpenses}
              rows={data.fixedBreakdown}
              emptyHint="Ninguna categoría marcada como fija. Ve a Categorías para clasificarlas."
            />
            <BreakdownPanel
              title="Gastos variables"
              total={data.variableTotal}
              totalExpenses={data.summary.totalExpenses}
              rows={data.variableBreakdown}
            />
          </div>

          {/* Recurring payments */}
          {data.recurring.length > 0 && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Pagos recurrentes detectados
                  </span>
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                  {data.recurring.length} pagos · {eur(data.recurringTotal)}/mes
                </span>
              </div>
              <div className="divide-y divide-[var(--card-border)]">
                {data.recurring.map((r) => (
                  <div key={r.name} className="flex items-center gap-3 py-2.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: r.categoryColor }}
                    />
                    <span className="flex-1 text-sm truncate" style={{ color: 'var(--foreground)' }}>
                      {r.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--card-border)', color: 'var(--muted)' }}
                    >
                      {r.monthCount} meses
                    </span>
                    <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--foreground)' }}>
                      {eur(r.monthlyAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6-month trend chart */}
          {trendChartData.length > 0 && (
            <div className="card p-4 space-y-3">
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Tendencia 6 meses
              </span>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendChartData} barSize={24} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--card-border)',
                      borderRadius: 8,
                      color: 'var(--foreground)',
                      fontSize: 12,
                    }}
                    formatter={(value) => eur(Number(value))}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }}
                  />
                  <Bar dataKey="Fijo" stackId="a" fill="var(--accent)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Variable" stackId="a" fill="var(--negative)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Invertido" stackId="b" fill="#6366F1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
