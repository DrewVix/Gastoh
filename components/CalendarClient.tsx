'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { getDaysInMonth, getDay, format } from 'date-fns'
import { es } from 'date-fns/locale'
import Skeleton from './Skeleton'

interface DaySummary { expenses: number; income: number; count: number }
interface CalTx {
  id: string; date: string; amount: number; description: string
  category: { name: string; color: string } | null
}
interface CalData {
  year: number; month: number
  days: Record<string, DaySummary>
  txsByDay: Record<string, CalTx[]>
}

interface Category {
  id: string
  name: string
  parentId: string | null
  parent: { id: string; name: string } | null
  children: { id: string }[]
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const INPUT_STYLE = { background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

function eur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Solo categorías "hoja" (subcategorías o categorías sin grupo) son asignables.
function buildCategoryOptions(categories: Category[]) {
  const groups = new Map<string, { label: string; items: Category[] }>()
  const standalone: Category[] = []
  for (const c of categories) {
    if (c.children.length > 0) continue
    if (c.parentId && c.parent) {
      const g = groups.get(c.parentId) ?? { label: c.parent.name, items: [] }
      g.items.push(c)
      groups.set(c.parentId, g)
    } else {
      standalone.push(c)
    }
  }
  return { groups: Array.from(groups.values()), standalone }
}

function CategoryOptions({ categories }: { categories: Category[] }) {
  const { groups, standalone } = buildCategoryOptions(categories)
  return (
    <>
      {groups.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
      {standalone.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </>
  )
}

export default function CalendarClient() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<CalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  // New transaction modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newType, setNewType] = useState<'gasto' | 'ingreso'>('gasto')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newIsTransfer, setNewIsTransfer] = useState(false)
  const [newSaving, setNewSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    setSelectedDay(null)
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [year, month])

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d?.flat ?? []))
  }, [])

  function openDayModal(dateKey: string) {
    setSelectedDay(dateKey)
    setNewDate(dateKey)
    setNewAmount('')
    setNewType('gasto')
    setNewDesc('')
    setNewCategory('')
    setNewNotes('')
    setNewIsTransfer(false)
    setShowNewModal(true)
  }

  async function submitTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate || !newAmount || !newDesc.trim()) return
    setNewSaving(true)
    const sign = newType === 'gasto' ? -1 : 1
    const body = {
      date: newDate,
      amount: sign * Math.abs(parseFloat(newAmount)),
      description: newDesc.trim(),
      categoryId: newCategory || null,
      notes: newNotes.trim() || null,
      isTransfer: newIsTransfer,
    }
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setNewSaving(false)
    setShowNewModal(false)
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setData(d))
  }

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
            style={{ color: 'var(--muted)' }}
            aria-label="Mes anterior">
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
            style={{ color: 'var(--muted)' }}
            aria-label="Mes siguiente">
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

        {loading && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="p-2" style={{ borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', minHeight: 80 }}>
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            ))}
          </div>
        )}

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
                  onClick={() => summary ? setSelectedDay(isSelected ? null : dateKey) : openDayModal(dateKey)}
                  style={{
                    borderRight: '1px solid var(--card-border)',
                    borderBottom: '1px solid var(--card-border)',
                    minHeight: 80,
                    background: isSelected
                      ? 'rgba(0,217,118,.15)'
                      : intensity > 0
                        ? `rgba(239,68,68,${intensity})`
                        : 'transparent',
                    cursor: 'pointer',
                  }}
                  className="p-2 flex flex-col justify-between transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                      style={{
                        background: isToday ? 'var(--accent)' : 'transparent',
                        color: isToday ? '#fff' : col >= 5 ? 'var(--accent)' : 'var(--foreground)',
                      }}>
                      {day}
                    </span>
                    {summary && summary.count > 0 && (
                      <span className="text-xs rounded-full px-1"
                        style={{ background: 'var(--negative-soft)', color: 'var(--negative)' }}>
                        {summary.count}
                      </span>
                    )}
                  </div>
                  {summary && summary.expenses > 0 && (
                    <div className="text-xs font-semibold tabular-nums text-right" style={{ color: 'var(--negative)' }}>
                      -{eur(summary.expenses)}
                    </div>
                  )}
                  {summary && summary.income > 0 && (
                    <div className="text-xs font-semibold tabular-nums text-right" style={{ color: 'var(--positive)' }}>
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
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--negative)' }}>{eur(totalExp)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Ingresos</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--positive)' }}>{eur(totalInc)}</div>
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
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <span className="text-sm font-semibold">
              {format(new Date(selectedDay + 'T12:00:00'), "d 'de' MMMM", { locale: es })}
            </span>
            <button
              onClick={() => openDayModal(selectedDay)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus size={12} />
              Añadir
            </button>
          </div>
          <div className="divide-y divide-[var(--card-border)]">
            {selectedTxs.map(tx => (
              <div key={tx.id} className="flex items-center px-5 py-3 gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: tx.category?.color ?? '#6b7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{tx.description}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {tx.category?.name ?? 'Sin categoría'}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums flex-shrink-0"
                  style={{ color: tx.amount < 0 ? 'var(--negative)' : 'var(--positive)' }}>
                  {tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New transaction modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false) }}>
          <div className="card w-full md:max-w-md p-6 space-y-4 rounded-t-2xl md:rounded-xl"
            style={{ background: 'var(--card)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Nueva transacción · {format(new Date(newDate + 'T12:00:00'), "d 'de' MMMM", { locale: es })}
              </h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 -m-2 hover:opacity-60" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <form onSubmit={submitTransaction} className="space-y-3">
              {/* Type toggle */}
              <div className="flex rounded-lg overflow-hidden text-sm" style={{ border: '1px solid var(--card-border)' }}>
                {(['gasto', 'ingreso'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setNewType(t)}
                    className="flex-1 py-2 capitalize transition-colors"
                    style={{
                      background: newType === t ? (t === 'gasto' ? 'var(--negative)' : 'var(--positive)') : 'transparent',
                      color: newType === t ? '#fff' : 'var(--muted)',
                    }}>
                    {t === 'gasto' ? 'Gasto' : 'Ingreso'}
                  </button>
                ))}
              </div>

              {/* Date + Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Fecha</label>
                  <input required type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
                    style={INPUT_STYLE} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Importe (€)</label>
                  <input required type="number" step="0.01" min="0" placeholder="0,00"
                    value={newAmount} onChange={e => setNewAmount(e.target.value)}
                    className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
                    style={INPUT_STYLE} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
                  {newType === 'gasto' ? 'Descripción *' : 'Concepto *'}
                </label>
                <input required type="text"
                  placeholder={newType === 'gasto' ? 'Ej: Compra en Mercadona' : 'Ej: Nómina, Bizum de un amigo'}
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
                  style={INPUT_STYLE} />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Categoría</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
                  style={INPUT_STYLE}>
                  <option value="">Sin categoría</option>
                  <CategoryOptions categories={categories} />
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Notas (opcional)</label>
                <input type="text" placeholder="Notas adicionales..."
                  value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
                  style={INPUT_STYLE} />
              </div>

              {/* Transfer */}
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={newIsTransfer} onChange={e => setNewIsTransfer(e.target.checked)}
                  className="accent-current" style={{ accentColor: 'var(--accent)' }} />
                Es una transferencia entre cuentas (no cuenta como gasto ni ingreso real)
              </label>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowNewModal(false)}
                  className="flex-1 text-sm py-2.5 rounded-lg transition-colors hover:opacity-80"
                  style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={newSaving}
                  className="flex-1 text-sm py-2.5 rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {newSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
