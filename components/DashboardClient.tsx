'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, differenceInCalendarMonths,
} from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function CategoryIcon({ name, size = 14, style }: { name: string | null | undefined; size?: number; style?: React.CSSProperties }) {
  if (!name) return null
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.FC<{ size?: number; style?: React.CSSProperties }> | undefined
  return Icon ? <Icon size={size} style={style} /> : null
}

type Preset = 'month' | 'prev-month' | 'quarter' | 'year' | 'custom'

interface CategoryRow {
  id: string | null
  name: string
  color: string
  total: number
  count: number
  pct: number
  trend: number | null
  baselineMonthly: number | null
  prevTotal: number | null
  isRecord: boolean
}

interface TxRow {
  id: string
  date: string
  description: string
  amount: number
  category: { name: string; color: string | null } | null
  bankAccount: { displayName: string } | null
}

interface DashboardData {
  from: string
  to: string
  periodDays: number
  incomeShifted: boolean
  incomePeriodLabel: string | null
  summary: {
    totalExpenses: number
    totalIncome: number
    netFlow: number
    transactionCount: number
    expenseCount: number
    avgPerDay: number
    savingsRate: number | null
    prev: {
      totalExpenses: number
      totalIncome: number
      netFlow: number
      transactionCount: number
      avgPerDay: number
    }
  }
  byCategory: CategoryRow[]
  byGroup: Array<{
    id: string; name: string; color: string; icon: string | null
    total: number; pct: number
    subcategories: CategoryRow[]
  }>
  bySource: Array<{ source: string; label: string; total: number; count: number }>
  topTransactions: Array<{ id: string; date: string; description: string; amount: number; category: string; categoryColor: string }>
  topMerchants: Array<{ name: string; total: number; count: number; categoryColor: string; categoryName: string }>
  trend: Array<{ month: string; expenses: number; income: number }>
  insights: Array<{ name: string; color: string; total: number; pct: number; trend: number | null; baselineMonthly: number | null }>
  projection: { projected: number; daysElapsed: number; totalDays: number; pctComplete: number } | null
  overallTrendPct: number
  recurring: Array<{ name: string; monthlyAmount: number; monthCount: number; categoryName: string; categoryColor: string }>
  recurringTotal: number
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'month', label: 'Este mes' },
  { id: 'prev-month', label: 'Mes ant.' },
  { id: 'quarter', label: '3 meses' },
  { id: 'year', label: 'Este año' },
  { id: 'custom', label: 'Personalizado' },
]

function getRange(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date()
  switch (preset) {
    case 'month':
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
    case 'prev-month': {
      const d = subMonths(now, 1)
      return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') }
    }
    case 'quarter':
      return { from: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
    case 'year':
      return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') }
    case 'custom':
      return { from: customFrom, to: customTo }
  }
}

function eur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function sign(n: number) { return n > 0 ? '+' : '' }

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const neutral = Math.abs(trend) <= 5
  const color = neutral ? 'var(--muted)' : trend > 0 ? '#EF4444' : '#22C55E'
  const Icon = neutral ? Minus : trend > 0 ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-0.5 text-xs tabular-nums" style={{ color }}>
      <Icon size={10} />{sign(trend)}{trend}%
    </span>
  )
}

const TT = { background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }
const TICK = { fontSize: 11, fill: '#6b7280' }

export default function DashboardClient() {
  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)
  const [catTxs, setCatTxs] = useState<TxRow[]>([])
  const [loadingCatTxs, setLoadingCatTxs] = useState(false)
  const [savingsGoal, setSavingsGoal] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  // Cargar objetivo guardado
  useEffect(() => {
    const saved = localStorage.getItem('gastoh_savings_goal')
    if (saved) setSavingsGoal(parseFloat(saved))
  }, [])

  function saveGoal(value: number) {
    setSavingsGoal(value)
    localStorage.setItem('gastoh_savings_goal', String(value))
    setEditingGoal(false)
  }

  function clearGoal() {
    setSavingsGoal(null)
    localStorage.removeItem('gastoh_savings_goal')
    setEditingGoal(false)
  }

  const load = useCallback(() => {
    const { from, to } = getRange(preset, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)
    setExpandedGroupId(null)
    setExpandedCatId(null)
    setCatTxs([])
    // Para mes actual y mes anterior: los ingresos se cuentan del mes previo
    // porque la nómina llega antes de que empiece el mes
    const shiftIncome = preset === 'month' || preset === 'prev-month'
    const url = `/api/dashboard?from=${from}&to=${to}${shiftIncome ? '&shiftIncome=1' : ''}`
    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [preset, customFrom, customTo])

  useEffect(() => { load() }, [load])

  async function toggleCategory(cat: CategoryRow) {
    const key = cat.id ?? '__none'
    if (expandedCatId === key) { setExpandedCatId(null); setCatTxs([]); return }
    setExpandedCatId(key)
    setCatTxs([])
    setLoadingCatTxs(true)
    const params = new URLSearchParams({
      from: data!.from,
      to: data!.to,
      limit: '100',
      excludeTransfers: '1',
      category: cat.id ?? 'none',
    })
    const res = await fetch(`/api/transactions?${params}`)
    const d = await res.json()
    setCatTxs(d.transactions ?? [])
    setLoadingCatTxs(false)
  }

  const s = data?.summary
  const prevLabel =
    preset === 'month' ? 'Mes ant.' :
    preset === 'prev-month' ? 'Mismo mes' :
    preset === 'quarter' ? 'Trim. ant.' :
    preset === 'year' ? 'Año ant.' : 'Per. ant.'

  const monthsElapsed = data
    ? Math.max(1, differenceInCalendarMonths(new Date(data.to + 'T12:00:00'), new Date(data.from + 'T12:00:00')) + 1)
    : 1

  const periodLabel = data
    ? `${format(new Date(data.from + 'T12:00:00'), 'd MMM')} – ${format(new Date(data.to + 'T12:00:00'), 'd MMM yyyy')}`
    : ''

  const showMonthCols = preset === 'month' || preset === 'prev-month' || preset === 'custom'
  const showQuarterCols = preset === 'quarter'
  const showYearCols = preset === 'year'
  const showProjection = showYearCols && monthsElapsed < 12

  return (
    <div className="space-y-5">

      {/* ── Header: título + selector ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-1 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: preset === p.id ? 'var(--accent)' : 'var(--card)',
                color: preset === p.id ? '#fff' : 'var(--muted)',
                border: '1px solid var(--card-border)',
              }}>{p.label}</button>
          ))}
        </div>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Desde</span>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg outline-none"
              style={{ background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Hasta</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg outline-none"
              style={{ background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>
        </div>
      )}

      {loading && <div className="py-24 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>}

      {data && !loading && (
        <>
          {/* ── KPI cards ── */}
          <div className="rounded-xl grid"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', gridTemplateColumns: 'repeat(4, 1fr)' }}>

            <div className="px-6 py-5">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
                Gasto · <span className="normal-case font-normal">{periodLabel}</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{eur(s!.totalExpenses)}</div>
              {s!.prev.totalExpenses > 0 && (() => {
                const delta = s!.totalExpenses - s!.prev.totalExpenses
                const pct = (delta / s!.prev.totalExpenses) * 100
                return (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: delta > 0 ? '#EF444420' : '#22C55E20', color: delta > 0 ? '#EF4444' : '#22C55E' }}>
                      {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {sign(pct)}{pct.toFixed(1)}%
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {sign(delta)}{eur(Math.abs(delta))} vs {prevLabel.toLowerCase()}
                    </span>
                  </div>
                )
              })()}
            </div>

            <div className="px-6 py-5" style={{ borderLeft: '1px solid var(--card-border)' }}>
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Flujo neto</div>
              <div className="text-3xl font-bold tabular-nums" style={{ color: s!.netFlow >= 0 ? '#22C55E' : '#EF4444' }}>
                {eur(s!.netFlow)}
              </div>
              {s!.savingsRate != null && (
                <div className="mt-2 text-xs">
                  <span style={{ color: s!.savingsRate >= 0 ? '#22C55E' : '#EF4444' }}>
                    {s!.savingsRate >= 0 ? `Ahorro del ${s!.savingsRate}%` : `Déficit del ${Math.abs(s!.savingsRate)}%`}
                  </span>
                  <span className="ml-1" style={{ color: 'var(--muted)' }}>de ingresos</span>
                </div>
              )}
              {s!.totalIncome > 0 && (
                <div className="text-xs mt-0.5" style={{ color: '#22C55E' }}>
                  {eur(s!.totalIncome)} ingresados
                  {data.incomeShifted && data.incomePeriodLabel && (
                    <span className="ml-1 opacity-60">(nómina {data.incomePeriodLabel})</span>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-5" style={{ borderLeft: '1px solid var(--card-border)' }}>
              {data.projection ? (
                <>
                  <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
                    {preset === 'year' ? 'Proyección fin de año' : 'Proyección fin de mes'}
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{eur(data.projection.projected)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${data.projection.pctComplete}%`, background: 'var(--accent)' }} />
                    </div>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                      día {data.projection.daysElapsed}/{data.projection.totalDays}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Media diaria</div>
                  <div className="text-3xl font-bold tabular-nums">{eur(s!.avgPerDay)}<span className="text-base font-normal">/día</span></div>
                </>
              )}
              {data.overallTrendPct !== 0 && (
                <div className="mt-2 text-xs flex items-center gap-1"
                  style={{ color: data.overallTrendPct > 0 ? '#EF4444' : '#22C55E' }}>
                  {data.overallTrendPct > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  Tendencia {sign(data.overallTrendPct)}{data.overallTrendPct}% últimos 6m
                </div>
              )}
            </div>

            <div className="px-6 py-5" style={{ borderLeft: '1px solid var(--card-border)' }}>
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
                Gastos fijos detectados
              </div>
              <div className="text-3xl font-bold tabular-nums">{eur(data.recurringTotal)}<span className="text-base font-normal">/mes</span></div>
              <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                {data.recurring.length} pagos recurrentes identificados
              </div>
            </div>
          </div>

          {/* ── Main grid: categorías (izq) + paneles (der) ── */}
          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 400px' }}>

            {/* Grupos de categorías */}
            {(data.byGroup ?? []).length > 0 && (
              <div className="card overflow-hidden min-w-0">
                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                    Gasto por categoría
                    <span className="ml-2 normal-case font-normal opacity-60">— expande grupos · clic en subcategoría para ver transacciones</span>
                  </span>
                </div>

                {showMonthCols && (
                  <div className="px-5 py-2 grid text-xs font-semibold"
                    style={{ color: 'var(--muted)', borderBottom: '1px solid var(--card-border)', gridTemplateColumns: '1fr 100px 100px 100px 70px 50px 28px' }}>
                    <span>Categoría</span>
                    <span className="text-right">Periodo</span>
                    <span className="text-right">{prevLabel}</span>
                    <span className="text-right">Diferencia</span>
                    <span className="text-right">% cambio</span>
                    <span className="text-right">% total</span>
                    <span />
                  </div>
                )}
                {showQuarterCols && (
                  <div className="px-5 py-2 grid text-xs font-semibold"
                    style={{ color: 'var(--muted)', borderBottom: '1px solid var(--card-border)', gridTemplateColumns: '1fr 100px 100px 90px 60px 28px' }}>
                    <span>Categoría</span>
                    <span className="text-right">Total 3m</span>
                    <span className="text-right">Media/mes</span>
                    <span className="text-right">vs histórico</span>
                    <span className="text-right">% total</span>
                    <span />
                  </div>
                )}
                {showYearCols && (
                  <div className="px-5 py-2 grid text-xs font-semibold"
                    style={{ color: 'var(--muted)', borderBottom: '1px solid var(--card-border)', gridTemplateColumns: showProjection ? '1fr 100px 100px 90px 100px 60px 28px' : '1fr 100px 100px 90px 60px 28px' }}>
                    <span>Categoría</span>
                    <span className="text-right">Total año</span>
                    <span className="text-right">Media/mes</span>
                    <span className="text-right">vs histórico</span>
                    {showProjection && <span className="text-right">Proyección</span>}
                    <span className="text-right">% total</span>
                    <span />
                  </div>
                )}

                <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {(data.byGroup ?? []).map((group) => {
                    const groupExpanded = expandedGroupId === group.id
                    const hasSubs = group.subcategories.length > 0

                    return (
                      <div key={group.id}>
                        {/* ── Fila de grupo ── */}
                        <div
                          className="px-5 py-3 space-y-1.5 cursor-pointer hover:bg-white/5 transition-colors"
                          style={{ background: hasSubs && groupExpanded ? 'rgba(255,255,255,.02)' : undefined }}
                          onClick={() => {
                            if (hasSubs) {
                              setExpandedGroupId(groupExpanded ? null : group.id)
                              setExpandedCatId(null)
                              setCatTxs([])
                            } else {
                              // Sin subcategorías: drill-down directo
                              const fakeCat: CategoryRow = { id: group.id, name: group.name, color: group.color, total: group.total, count: 0, pct: group.pct, trend: null, baselineMonthly: null, prevTotal: null, isRecord: false }
                              toggleCategory(fakeCat)
                            }
                          }}
                        >
                          {showMonthCols && (
                            <div className="grid items-center gap-2"
                              style={{ gridTemplateColumns: '1fr 100px 100px 100px 70px 50px 28px' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 flex items-center justify-center"
                                  style={{ color: group.color }}>
                                  <CategoryIcon name={group.icon} size={14} />
                                </span>
                                <span className="text-sm font-semibold truncate">{group.name}</span>
                              </div>
                              <span className="text-sm font-bold tabular-nums text-right">{eur(group.total)}</span>
                              <span className="text-sm tabular-nums text-right" style={{ color: 'var(--muted)' }}>—</span>
                              <span className="text-sm tabular-nums text-right" style={{ color: 'var(--muted)' }}>—</span>
                              <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>—</span>
                              <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>{group.pct.toFixed(1)}%</span>
                              <span className="flex justify-end" style={{ color: 'var(--muted)' }}>
                                {hasSubs ? (groupExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <ChevronRight size={13} />}
                              </span>
                            </div>
                          )}
                          {showQuarterCols && (
                            <div className="grid items-center gap-2"
                              style={{ gridTemplateColumns: '1fr 100px 100px 90px 60px 28px' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span style={{ color: group.color }}><CategoryIcon name={group.icon} size={14} /></span>
                                <span className="text-sm font-semibold truncate">{group.name}</span>
                              </div>
                              <span className="text-sm font-bold tabular-nums text-right">{eur(group.total)}</span>
                              <span className="text-sm tabular-nums text-right" style={{ color: 'var(--muted)' }}>{eur(group.total / 3)}</span>
                              <span className="text-right" style={{ color: 'var(--muted)' }}>—</span>
                              <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>{group.pct.toFixed(1)}%</span>
                              <span className="flex justify-end" style={{ color: 'var(--muted)' }}>
                                {hasSubs ? (groupExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <ChevronRight size={13} />}
                              </span>
                            </div>
                          )}
                          {showYearCols && (
                            <div className="grid items-center gap-2"
                              style={{ gridTemplateColumns: showProjection ? '1fr 100px 100px 90px 100px 60px 28px' : '1fr 100px 100px 90px 60px 28px' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span style={{ color: group.color }}><CategoryIcon name={group.icon} size={14} /></span>
                                <span className="text-sm font-semibold truncate">{group.name}</span>
                              </div>
                              <span className="text-sm font-bold tabular-nums text-right">{eur(group.total)}</span>
                              <span className="text-sm tabular-nums text-right" style={{ color: 'var(--muted)' }}>{eur(group.total / monthsElapsed)}</span>
                              <span className="text-right" style={{ color: 'var(--muted)' }}>—</span>
                              {showProjection && (
                                <span className="text-sm tabular-nums text-right" style={{ color: 'var(--muted)' }}>
                                  {eur(Math.round((group.total / monthsElapsed) * 12))}
                                </span>
                              )}
                              <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>{group.pct.toFixed(1)}%</span>
                              <span className="flex justify-end" style={{ color: 'var(--muted)' }}>
                                {hasSubs ? (groupExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <ChevronRight size={13} />}
                              </span>
                            </div>
                          )}
                          <div className="h-0.5 rounded-full" style={{ background: 'var(--card-border)' }}>
                            <div className="h-0.5 rounded-full" style={{ width: `${Math.min(100, group.pct)}%`, background: group.color }} />
                          </div>
                        </div>

                        {/* ── Subcategorías ── */}
                        {hasSubs && groupExpanded && (
                          <div style={{ borderTop: '1px solid var(--card-border)' }}>
                            {group.subcategories.map((cat) => {
                              const key = cat.id ?? '__none'
                              const catExpanded = expandedCatId === key
                              const diff = cat.prevTotal != null ? cat.total - cat.prevTotal : null
                              const diffPct = cat.prevTotal != null && cat.prevTotal > 0
                                ? ((cat.total - cat.prevTotal) / cat.prevTotal) * 100 : null

                              return (
                                <div key={key} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                  <div
                                    className="py-2.5 space-y-1 cursor-pointer hover:bg-white/5 transition-colors"
                                    style={{ paddingLeft: '2.5rem', paddingRight: '1.25rem', background: 'rgba(255,255,255,.01)' }}
                                    onClick={() => toggleCategory(cat)}
                                  >
                                    {showMonthCols && (
                                      <div className="grid items-center gap-2"
                                        style={{ gridTemplateColumns: '1fr 100px 100px 100px 70px 50px 28px' }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: cat.color }} />
                                          <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{cat.name}</span>
                                          {cat.isRecord && (
                                            <span className="text-xs px-1 py-0.5 rounded font-semibold flex-shrink-0"
                                              style={{ background: '#EF444420', color: '#EF4444', fontSize: '9px' }}>RÉCORD</span>
                                          )}
                                        </div>
                                        <span className="text-xs font-semibold tabular-nums text-right">{eur(cat.total)}</span>
                                        <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>
                                          {cat.prevTotal != null ? eur(cat.prevTotal) : '—'}
                                        </span>
                                        <span className="text-xs tabular-nums text-right font-medium"
                                          style={{ color: diff == null ? 'var(--muted)' : diff > 0 ? '#EF4444' : '#22C55E' }}>
                                          {diff != null ? `${sign(diff)}${eur(Math.abs(diff))}` : '—'}
                                        </span>
                                        <span className="text-xs tabular-nums text-right"
                                          style={{ color: diffPct == null ? 'var(--muted)' : diffPct > 0 ? '#EF4444' : '#22C55E' }}>
                                          {diffPct != null ? `${sign(diffPct)}${diffPct.toFixed(1)}%` : '—'}
                                        </span>
                                        <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>
                                          {cat.pct.toFixed(1)}%
                                        </span>
                                        <span className="flex justify-end" style={{ color: 'var(--muted)' }}>
                                          {catExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </span>
                                      </div>
                                    )}
                                    {showQuarterCols && (
                                      <div className="grid items-center gap-2"
                                        style={{ gridTemplateColumns: '1fr 100px 100px 90px 60px 28px' }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: cat.color }} />
                                          <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{cat.name}</span>
                                        </div>
                                        <span className="text-xs font-semibold tabular-nums text-right">{eur(cat.total)}</span>
                                        <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>{eur(cat.total / 3)}</span>
                                        <div className="text-right"><TrendBadge trend={cat.trend} /></div>
                                        <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>{cat.pct.toFixed(1)}%</span>
                                        <span className="flex justify-end" style={{ color: 'var(--muted)' }}>
                                          {catExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </span>
                                      </div>
                                    )}
                                    {showYearCols && (
                                      <div className="grid items-center gap-2"
                                        style={{ gridTemplateColumns: showProjection ? '1fr 100px 100px 90px 100px 60px 28px' : '1fr 100px 100px 90px 60px 28px' }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: cat.color }} />
                                          <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{cat.name}</span>
                                        </div>
                                        <span className="text-xs font-semibold tabular-nums text-right">{eur(cat.total)}</span>
                                        <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>{eur(cat.total / monthsElapsed)}</span>
                                        <div className="text-right"><TrendBadge trend={cat.trend} /></div>
                                        {showProjection && (
                                          <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>
                                            {eur(Math.round((cat.total / monthsElapsed) * 12))}
                                          </span>
                                        )}
                                        <span className="text-xs tabular-nums text-right" style={{ color: 'var(--muted)' }}>{cat.pct.toFixed(1)}%</span>
                                        <span className="flex justify-end" style={{ color: 'var(--muted)' }}>
                                          {catExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {catExpanded && (
                                    <div style={{ background: 'rgba(255,255,255,.01)', borderTop: '1px solid var(--card-border)' }}>
                                      {loadingCatTxs && (
                                        <div className="py-4 flex items-center gap-2 text-sm" style={{ paddingLeft: '3rem', color: 'var(--muted)' }}>
                                          <RefreshCw size={12} className="animate-spin" /> Cargando...
                                        </div>
                                      )}
                                      {!loadingCatTxs && catTxs.length === 0 && (
                                        <div className="py-4 text-xs" style={{ paddingLeft: '3rem', color: 'var(--muted)' }}>Sin transacciones</div>
                                      )}
                                      {!loadingCatTxs && catTxs.map((tx) => (
                                        <div key={tx.id} className="flex items-center py-2 gap-3 border-t"
                                          style={{ paddingLeft: '3rem', paddingRight: '1.25rem', borderColor: 'var(--card-border)' }}>
                                          <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--muted)' }}>
                                            {format(new Date(tx.date), 'dd/MM/yy')}
                                          </span>
                                          <span className="flex-1 truncate text-xs">{tx.description}</span>
                                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                                            {tx.bankAccount?.displayName ?? 'Importado'}
                                          </span>
                                          <span className="text-xs font-semibold tabular-nums flex-shrink-0"
                                            style={{ color: tx.amount < 0 ? '#EF4444' : '#22C55E' }}>
                                            {tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Columna derecha: paneles apilados */}
            <div className="space-y-5 min-w-0">

              {/* Objetivo de ahorro */}
              {(preset === 'month' || preset === 'prev-month') && s && (() => {
                const suggested = Math.max(0, Math.round(s.totalIncome - data.recurringTotal))
                const goal = savingsGoal ?? suggested
                const actual = Math.max(0, s.netFlow)
                const pct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0
                const deficit = goal - actual
                const isOnTrack = actual >= goal * 0.8

                return (
                  <div className="card overflow-hidden">
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                        Objetivo de ahorro
                      </span>
                      <button
                        onClick={() => { setEditingGoal(true); setGoalInput(String(goal)) }}
                        className="text-xs px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--muted)' }}>
                        {savingsGoal ? 'Editar' : 'Personalizar'}
                      </button>
                    </div>

                    {editingGoal ? (
                      <div className="px-5 py-4 space-y-3">
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          Sugerido basado en ingresos − gastos fijos: <strong style={{ color: 'var(--foreground)' }}>{eur(suggested)}</strong>
                        </p>
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            value={goalInput}
                            onChange={e => setGoalInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveGoal(parseFloat(goalInput) || suggested)
                              if (e.key === 'Escape') setEditingGoal(false)
                            }}
                            className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
                            style={{ background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                            autoFocus
                          />
                          <span className="text-sm" style={{ color: 'var(--muted)' }}>€</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveGoal(parseFloat(goalInput) || suggested)}
                            className="text-xs px-3 py-1.5 rounded"
                            style={{ background: 'var(--accent)', color: '#fff' }}>
                            Guardar
                          </button>
                          <button onClick={() => saveGoal(suggested)}
                            className="text-xs px-3 py-1.5 rounded"
                            style={{ background: 'var(--card-border)', color: 'var(--muted)' }}>
                            Usar sugerido ({eur(suggested)})
                          </button>
                          {savingsGoal && (
                            <button onClick={clearGoal}
                              className="text-xs px-3 py-1.5 rounded text-red-400 hover:bg-white/10">
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-4 space-y-4">
                        {/* Barra de progreso */}
                        <div>
                          <div className="flex items-end justify-between mb-1.5">
                            <span className="text-2xl font-bold tabular-nums" style={{ color: isOnTrack ? '#22C55E' : '#F59E0B' }}>
                              {eur(actual)}
                            </span>
                            <span className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>
                              / {eur(goal)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                            <div className="h-2 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: isOnTrack ? '#22C55E' : pct > 50 ? '#F59E0B' : '#EF4444' }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs" style={{ color: isOnTrack ? '#22C55E' : '#F59E0B' }}>
                              {pct}% del objetivo
                            </span>
                            {deficit > 0 && (
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                                faltan {eur(deficit)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Desglose */}
                        <div className="space-y-1.5 text-xs pt-1" style={{ borderTop: '1px solid var(--card-border)' }}>
                          <div className="flex justify-between pt-2">
                            <span style={{ color: 'var(--muted)' }}>Ingresos</span>
                            <span className="tabular-nums" style={{ color: '#22C55E' }}>+{eur(s.totalIncome)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: 'var(--muted)' }}>Gastos fijos</span>
                            <span className="tabular-nums" style={{ color: '#EF4444' }}>−{eur(data.recurringTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: 'var(--muted)' }}>Gasto variable</span>
                            <span className="tabular-nums" style={{ color: '#EF4444' }}>−{eur(Math.max(0, s.totalExpenses - data.recurringTotal))}</span>
                          </div>
                          <div className="flex justify-between font-semibold pt-1" style={{ borderTop: '1px solid var(--card-border)' }}>
                            <span>Ahorro real</span>
                            <span className="tabular-nums" style={{ color: actual >= 0 ? '#22C55E' : '#EF4444' }}>
                              {actual >= 0 ? '+' : ''}{eur(s.netFlow)}
                            </span>
                          </div>
                        </div>

                        {!savingsGoal && (
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Objetivo sugerido: ingresos − gastos fijos detectados
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Insights */}
              {data.insights.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                      Donde puedes ahorrar
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                    {data.insights.map((ins, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ins.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{ins.name}</div>
                          {ins.baselineMonthly != null && (
                            <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                              Media: {eur(ins.baselineMonthly)}/mes
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold tabular-nums">{eur(ins.total)}</div>
                          <div className="flex items-center justify-end gap-1 text-xs mt-0.5" style={{ color: '#EF4444' }}>
                            <TrendingUp size={10} />+{ins.trend}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top comercios */}
              {data.topMerchants.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Donde más gastas</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                    {data.topMerchants.map((m, i) => (
                      <div key={i} className="flex items-center px-5 py-3 gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.categoryColor }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate font-medium">{m.name}</div>
                          <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.categoryName}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold tabular-nums">{eur(m.total)}</div>
                          <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.count} {m.count === 1 ? 'vez' : 'veces'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gastos recurrentes */}
              {data.recurring.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-2">
                      <RefreshCw size={13} style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                        Gastos fijos
                      </span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--muted)' }}>
                      {eur(data.recurringTotal)}/mes
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                    {data.recurring.map((r, i) => (
                      <div key={i} className="flex items-center px-5 py-3 gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.categoryColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate font-medium">{r.name}</div>
                          <div className="text-xs" style={{ color: 'var(--muted)' }}>
                            {r.categoryName} · {r.monthCount} meses
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums flex-shrink-0">{eur(r.monthlyAmount)}/mes</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Fila inferior: gráfico 12m + top transacciones ── */}
          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 400px' }}>

            {/* Gráfico 12 meses */}
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted)' }}>Evolución 12 meses</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.trend} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
                  <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
                  <Tooltip contentStyle={TT} formatter={(v) => eur(Number(v))} />
                  <Bar dataKey="expenses" name="Gastos" fill="#EF4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="income" name="Ingresos" fill="#22C55E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top transacciones */}
            {data.topTransactions.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Mayores gastos</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {data.topTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center px-5 py-3 gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tx.categoryColor }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{tx.description}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{tx.category} · {tx.date}</div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-red-400 flex-shrink-0">{eur(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Cuentas ── */}
          {data.bySource.length > 1 && (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(data.bySource.length, 6)}, 1fr)` }}>
              {data.bySource.map((src) => (
                <div key={src.source} className="card p-4">
                  <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>{src.label}</div>
                  <div className="text-xl font-semibold tabular-nums">{eur(src.total)}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{src.count} transacciones</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
