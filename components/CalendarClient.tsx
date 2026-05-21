'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getDaysInMonth, getDay, format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DaySummary { expenses: number; income: number; count: number }
interface CalTx {
  id: string; date: string; amount: number; description: string
  merchantName: string | null; category: { name: string; color: string } | null
}
interface CalData {
  year: number; month: number
  days: Record<string, DaySummary>
  txsByDay: Record<string, CalTx[]>
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function eur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CalendarClient() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<CalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setSelectedDay(null)
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // Calendar grid
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1))
  const firstDayOfWeek = (getDay(new Date(year, month - 1, 1)) + 6) % 7 // Monday=0

  const maxExpenses = data
    ? Math.max(1, ...Object.values(data.days).map(d => d.expenses))
    : 1

  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: es })

  const selectedTxs = selectedDay && data ? (data.txsByDay[selectedDay] ?? []) : []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold capitalize">{monthLabel}</h1>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--muted)' }}>
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
            Hoy
          </button>
          <button onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--muted)' }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="card overflow-hidden">
        {/* Day headers */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--card-border)' }}>
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--muted)' }}>{d}</div>
          ))}
        </div>

        {loading && <div className="py-24 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>}

        {!loading && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} style={{ borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', minHeight: 80 }} />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const summary = data?.days[dateKey]
              const isToday = dateKey === format(now, 'yyyy-MM-dd')
              const isSelected = selectedDay === dateKey
              const intensity = summary ? (summary.expenses / maxExpenses) * 0.25 : 0
              const col = (firstDayOfWeek + day - 1) % 7

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : (summary ? dateKey : null))}
                  style={{
                    borderRight: '1px solid var(--card-border)',
                    borderBottom: '1px solid var(--card-border)',
                    minHeight: 80,
                    background: isSelected
                      ? 'rgba(99,102,241,.15)'
                      : intensity > 0
                        ? `rgba(239,68,68,${intensity})`
                        : 'transparent',
                    cursor: summary ? 'pointer' : 'default',
                  }}
                  className="p-2 flex flex-col justify-between transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                      style={{
                        background: isToday ? 'var(--accent)' : 'transparent',
                        color: isToday ? '#fff' : col >= 5 ? '#818cf8' : 'var(--foreground)',
                      }}>
                      {day}
                    </span>
                    {summary && summary.count > 0 && (
                      <span className="text-xs rounded-full px-1"
                        style={{ background: 'rgba(239,68,68,.15)', color: '#EF4444' }}>
                        {summary.count}
                      </span>
                    )}
                  </div>
                  {summary && summary.expenses > 0 && (
                    <div className="text-xs font-semibold tabular-nums text-right" style={{ color: '#EF4444' }}>
                      -{eur(summary.expenses)}
                    </div>
                  )}
                  {summary && summary.income > 0 && (
                    <div className="text-xs font-semibold tabular-nums text-right" style={{ color: '#22C55E' }}>
                      +{eur(summary.income)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Monthly summary */}
      {data && !loading && (() => {
        const totalExp = Object.values(data.days).reduce((s, d) => s + d.expenses, 0)
        const totalInc = Object.values(data.days).reduce((s, d) => s + d.income, 0)
        const activeDays = Object.values(data.days).filter(d => d.expenses > 0).length
        return (
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Gasto total</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: '#EF4444' }}>{eur(totalExp)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Ingresos</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: '#22C55E' }}>{eur(totalInc)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Días con gastos</div>
              <div className="text-2xl font-bold tabular-nums">{activeDays} <span className="text-base font-normal" style={{ color: 'var(--muted)' }}>días</span></div>
            </div>
          </div>
        )
      })()}

      {/* Selected day transactions */}
      {selectedDay && selectedTxs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <span className="text-sm font-semibold">
              {format(new Date(selectedDay + 'T12:00:00'), "d 'de' MMMM", { locale: es })}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
            {selectedTxs.map(tx => (
              <div key={tx.id} className="flex items-center px-5 py-3 gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: tx.category?.color ?? '#6b7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{tx.merchantName ?? tx.description}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {tx.category?.name ?? 'Sin categoría'}
                    {tx.merchantName && tx.merchantName !== tx.description && (
                      <span className="ml-1 opacity-60">· {tx.description}</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums flex-shrink-0"
                  style={{ color: tx.amount < 0 ? '#EF4444' : '#22C55E' }}>
                  {tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
