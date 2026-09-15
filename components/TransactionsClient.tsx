'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Search, ChevronLeft, ChevronRight, Pencil, Check, X, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  parentId: string | null
  isFixed: boolean
  parent: { id: string; name: string; color: string | null; icon: string | null } | null
}

function isFixedExpense(category: Category | null): boolean {
  return !!category?.isFixed
}
interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  currency: string
  isManual: boolean
  isTransfer: boolean
  notes: string | null
  category: Category | null
}

function fmt(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

const INPUT_STYLE = { background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState<'' | 'gasto' | 'ingreso' | 'transferencia'>('')
  const [filterFixed, setFilterFixed] = useState<'' | 'fixed' | 'variable'>('')
  const [filterMinAmount, setFilterMinAmount] = useState('')
  const [filterMaxAmount, setFilterMaxAmount] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Mobile filter panel state
  const [showFilters, setShowFilters] = useState(false)

  // Notes editing
  const [editNotesId, setEditNotesId] = useState<string | null>(null)
  const [editNotesValue, setEditNotesValue] = useState('')

  // New/edit transaction modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [editTxId, setEditTxId] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newType, setNewType] = useState<'gasto' | 'ingreso'>('gasto')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newIsTransfer, setNewIsTransfer] = useState(false)
  const [newSaving, setNewSaving] = useState(false)

  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(q && { q }),
      ...(filterCategory && { category: filterCategory }),
      ...(filterMonth && { month: filterMonth }),
      ...(filterType && { type: filterType }),
      ...(filterFixed && { fixed: filterFixed }),
      ...(filterMinAmount && { minAmount: filterMinAmount }),
      ...(filterMaxAmount && { maxAmount: filterMaxAmount }),
      sortBy,
      sortDir,
    })
    const res = await fetch(`/api/transactions?${params}`)
    const data = await res.json()
    setTransactions(data.transactions ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, q, filterCategory, filterMonth, filterType, filterFixed, filterMinAmount, filterMaxAmount, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d?.flat ?? []))
  }, [])

  async function patch(id: string, body: object) {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    load()
  }

  async function updateCategory(id: string, categoryId: string) {
    await patch(id, { categoryId: categoryId || null })
    setEditingId(null)
  }

  async function saveNotes(id: string) {
    await patch(id, { notes: editNotesValue.trim() || null })
    setEditNotesId(null)
  }

  const totalPages = Math.ceil(total / limit)

  function openNewModal() {
    setEditTxId(null)
    setNewDate(format(new Date(), 'yyyy-MM-dd'))
    setNewAmount('')
    setNewType('gasto')
    setNewDesc('')
    setNewCategory('')
    setNewNotes('')
    setNewIsTransfer(false)
    setShowNewModal(true)
  }

  function openEditModal(tx: Transaction) {
    setEditTxId(tx.id)
    setNewDate(tx.date.slice(0, 10))
    setNewAmount(String(Math.abs(tx.amount)))
    setNewType(tx.amount < 0 ? 'gasto' : 'ingreso')
    setNewDesc(tx.description)
    setNewCategory(tx.category?.id ?? '')
    setNewNotes(tx.notes ?? '')
    setNewIsTransfer(tx.isTransfer)
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
    await fetch(editTxId ? `/api/transactions/${editTxId}` : '/api/transactions', {
      method: editTxId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setNewSaving(false)
    setShowNewModal(false)
    setEditTxId(null)
    load()
  }

  async function deleteTransaction(id: string, description: string) {
    if (!confirm(`¿Eliminar "${description}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    load()
  }

  const SEL = { background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

  // Count active filters for badge
  const activeFilterCount = [q, filterCategory, filterMonth, filterType, filterFixed, filterMinAmount, filterMaxAmount].filter(Boolean).length
    + (sortBy !== 'date' || sortDir !== 'desc' ? 1 : 0)

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      {/* Desktop toolbar */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold mr-1">Transacciones</h1>

        <div className="flex items-center gap-2 w-52"
          style={{ background: '#0a0a0b', border: '1px solid var(--card-border)', borderRadius: 8, padding: '5px 10px' }}>
          <Search size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Buscar..." value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            className="flex-1 text-sm bg-transparent outline-none min-w-0" />
        </div>

        <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
          className="text-sm px-3 py-1.5 rounded-lg outline-none" style={SEL}>
          <option value="">Todos los meses</option>
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date(); d.setMonth(d.getMonth() - i)
            const val = format(d, 'yyyy-MM')
            return <option key={val} value={val}>{format(d, 'MMMM yyyy')}</option>
          })}
        </select>

        <select value={filterType} onChange={(e) => { setFilterType(e.target.value as typeof filterType); setPage(1) }}
          className="text-sm px-3 py-1.5 rounded-lg outline-none" style={SEL}>
          <option value="">Gastos e ingresos</option>
          <option value="gasto">Solo gastos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="transferencia">Solo transferencias</option>
        </select>

        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
          className="text-sm px-3 py-1.5 rounded-lg outline-none" style={SEL}>
          <option value="">Todas las categorías</option>
          <option value="none">Sin categoría</option>
          {(() => {
            const groups = new Map<string, { label: string; items: Category[] }>()
            const ungrouped: Category[] = []
            for (const c of categories) {
              if (c.parentId && c.parent) {
                const g = groups.get(c.parentId) ?? { label: c.parent.name, items: [] }
                g.items.push(c)
                groups.set(c.parentId, g)
              } else if (!categories.some(p => p.id === c.parentId)) {
                ungrouped.push(c)
              }
            }
            return (
              <>
                {Array.from(groups.values()).map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
                {ungrouped.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </>
            )
          })()}
        </select>

        <button
          onClick={() => setShowMoreFilters(v => !v)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg relative transition-colors"
          style={{
            background: (filterFixed || filterMinAmount || filterMaxAmount || sortBy !== 'date' || sortDir !== 'desc') ? 'rgba(0,217,118,.15)' : 'var(--card)',
            border: `1px solid ${(filterFixed || filterMinAmount || filterMaxAmount || sortBy !== 'date' || sortDir !== 'desc') ? 'rgba(0,217,118,.4)' : 'var(--card-border)'}`,
            color: (filterFixed || filterMinAmount || filterMaxAmount || sortBy !== 'date' || sortDir !== 'desc') ? 'var(--accent)' : 'var(--muted)',
          }}>
          <SlidersHorizontal size={14} />
          Más filtros
        </button>

        <div className="flex-1" />

        <button
          onClick={openNewModal}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Plus size={14} />
          Nueva
        </button>
      </div>

      {/* Desktop: more filters (amount range + sort) */}
      {showMoreFilters && (
        <div className="hidden md:flex items-center gap-2 card p-3">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Gasto</span>
          <select value={filterFixed} onChange={(e) => { setFilterFixed(e.target.value as typeof filterFixed); setPage(1) }}
            className="text-sm px-3 py-1.5 rounded-lg outline-none" style={SEL}>
            <option value="">Fijo o variable</option>
            <option value="fixed">Solo fijos</option>
            <option value="variable">Solo variables</option>
          </select>

          <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>Importe</span>
          <input type="number" min="0" step="0.01" placeholder="Mín €" value={filterMinAmount}
            onChange={(e) => { setFilterMinAmount(e.target.value); setPage(1) }}
            className="w-24 text-sm px-2.5 py-1.5 rounded-lg outline-none" style={SEL} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>–</span>
          <input type="number" min="0" step="0.01" placeholder="Máx €" value={filterMaxAmount}
            onChange={(e) => { setFilterMaxAmount(e.target.value); setPage(1) }}
            className="w-24 text-sm px-2.5 py-1.5 rounded-lg outline-none" style={SEL} />

          <span className="text-xs ml-3" style={{ color: 'var(--muted)' }}>Ordenar por</span>
          <select value={`${sortBy}-${sortDir}`}
            onChange={(e) => { const [b, d] = e.target.value.split('-'); setSortBy(b as 'date' | 'amount'); setSortDir(d as 'asc' | 'desc') }}
            className="text-sm px-3 py-1.5 rounded-lg outline-none" style={SEL}>
            <option value="date-desc">Fecha (recientes primero)</option>
            <option value="date-asc">Fecha (antiguas primero)</option>
            <option value="amount-desc">Importe (mayor primero)</option>
            <option value="amount-asc">Importe (menor primero)</option>
          </select>

          {(filterFixed || filterMinAmount || filterMaxAmount || sortBy !== 'date' || sortDir !== 'desc') && (
            <button
              onClick={() => { setFilterFixed(''); setFilterMinAmount(''); setFilterMaxAmount(''); setSortBy('date'); setSortDir('desc') }}
              className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors ml-1" style={{ color: 'var(--muted)' }}>
              Restablecer
            </button>
          )}
        </div>
      )}

      {/* Mobile toolbar */}
      <div className="flex md:hidden items-center gap-2">
        <h1 className="text-lg font-semibold flex-1">Transacciones</h1>
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg relative"
          style={{
            background: activeFilterCount > 0 ? 'rgba(0,217,118,.15)' : 'var(--card)',
            border: `1px solid ${activeFilterCount > 0 ? 'rgba(0,217,118,.4)' : 'var(--card-border)'}`,
            color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--muted)',
          }}>
          <SlidersHorizontal size={15} />
          Filtros
          {activeFilterCount > 0 && (
            <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile filter panel (collapsible) */}
      {showFilters && (
        <div className="md:hidden card p-4 space-y-3">
          <div className="flex items-center gap-2"
            style={{ background: '#0a0a0b', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px' }}>
            <Search size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input type="text" placeholder="Buscar..." value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              className="flex-1 text-sm bg-transparent outline-none min-w-0" />
            {q && <button onClick={() => { setQ(''); setPage(1) }}><X size={13} style={{ color: 'var(--muted)' }} /></button>}
          </div>

          <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none" style={SEL}>
            <option value="">Todos los meses</option>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i)
              const val = format(d, 'yyyy-MM')
              return <option key={val} value={val}>{format(d, 'MMMM yyyy')}</option>
            })}
          </select>

          <select value={filterType} onChange={(e) => { setFilterType(e.target.value as typeof filterType); setPage(1) }}
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none" style={SEL}>
            <option value="">Gastos e ingresos</option>
            <option value="gasto">Solo gastos</option>
            <option value="ingreso">Solo ingresos</option>
            <option value="transferencia">Solo transferencias</option>
          </select>

          <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none" style={SEL}>
            <option value="">Todas las categorías</option>
            <option value="none">Sin categoría</option>
            {(() => {
              const groups = new Map<string, { label: string; items: Category[] }>()
              const ungrouped: Category[] = []
              for (const c of categories) {
                if (c.parentId && c.parent) {
                  const g = groups.get(c.parentId) ?? { label: c.parent.name, items: [] }
                  g.items.push(c)
                  groups.set(c.parentId, g)
                } else if (!categories.some(p => p.id === c.parentId)) {
                  ungrouped.push(c)
                }
              }
              return (
                <>
                  {Array.from(groups.values()).map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ))}
                  {ungrouped.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </>
              )
            })()}
          </select>

          <select value={filterFixed} onChange={(e) => { setFilterFixed(e.target.value as typeof filterFixed); setPage(1) }}
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none" style={SEL}>
            <option value="">Fijo o variable</option>
            <option value="fixed">Solo gastos fijos</option>
            <option value="variable">Solo gastos variables</option>
          </select>

          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.01" placeholder="Importe mín €" value={filterMinAmount}
              onChange={(e) => { setFilterMinAmount(e.target.value); setPage(1) }}
              className="flex-1 text-sm px-3 py-2.5 rounded-lg outline-none min-w-0" style={SEL} />
            <input type="number" min="0" step="0.01" placeholder="Importe máx €" value={filterMaxAmount}
              onChange={(e) => { setFilterMaxAmount(e.target.value); setPage(1) }}
              className="flex-1 text-sm px-3 py-2.5 rounded-lg outline-none min-w-0" style={SEL} />
          </div>

          <select value={`${sortBy}-${sortDir}`}
            onChange={(e) => { const [b, d] = e.target.value.split('-'); setSortBy(b as 'date' | 'amount'); setSortDir(d as 'asc' | 'desc') }}
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none" style={SEL}>
            <option value="date-desc">Fecha (recientes primero)</option>
            <option value="date-asc">Fecha (antiguas primero)</option>
            <option value="amount-desc">Importe (mayor primero)</option>
            <option value="amount-asc">Importe (menor primero)</option>
          </select>

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setQ(''); setFilterCategory(''); setFilterMonth('')
                setFilterType(''); setFilterFixed(''); setFilterMinAmount(''); setFilterMaxAmount(''); setSortBy('date'); setSortDir('desc')
                setPage(1)
              }}
              className="w-full text-sm py-2 rounded-lg"
              style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Desktop Table ── */}
      <div className="hidden md:block card overflow-hidden">
        <div className="px-5 py-2.5 border-b text-xs font-semibold grid"
          style={{ borderColor: 'var(--card-border)', color: 'var(--muted)', gridTemplateColumns: '88px 1fr 110px 200px 64px' }}>
          <span>FECHA</span>
          <span>DESCRIPCIÓN</span>
          <span className="text-right">IMPORTE</span>
          <span className="text-center">CATEGORÍA</span>
          <span />
        </div>

        {loading && <div className="py-12 text-center" style={{ color: 'var(--muted)' }}>Cargando...</div>}
        {!loading && transactions.length === 0 && (
          <div className="py-12 text-center" style={{ color: 'var(--muted)' }}>No hay transacciones con estos filtros</div>
        )}

        <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
          {transactions.map((tx) => (
            <div key={tx.id}>
              {/* Main row */}
              <div className="px-5 py-3 grid items-center gap-2 hover:bg-white/[0.025] transition-colors group/row"
                style={{ gridTemplateColumns: '88px 1fr 110px 200px 64px' }}>
                <div>
                  <div className="text-xs font-medium tabular-nums">{format(new Date(tx.date), 'dd MMM')}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{format(new Date(tx.date), 'yyyy')}</div>
                </div>

                {/* Description + notes */}
                <div className="min-w-0">
                  <div className="text-sm truncate">{tx.description}</div>

                  {/* Notes: editable */}
                  {editNotesId === tx.id ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        autoFocus
                        type="text"
                        value={editNotesValue}
                        onChange={e => setEditNotesValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNotes(tx.id); if (e.key === 'Escape') setEditNotesId(null) }}
                        className="text-xs px-2 py-0.5 rounded outline-none flex-1"
                        style={INPUT_STYLE}
                        placeholder="Añadir nota..."
                      />
                      <button onClick={() => saveNotes(tx.id)} className="p-0.5 text-green-400"><Check size={12} /></button>
                      <button onClick={() => setEditNotesId(null)} className="p-0.5" style={{ color: 'var(--muted)' }}><X size={12} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditNotesId(tx.id); setEditNotesValue(tx.notes ?? '') }}
                      className="flex items-center gap-1 mt-0.5 group/notes"
                      style={{ color: 'var(--muted)' }}
                    >
                      {tx.notes ? (
                        <span className="text-xs truncate max-w-[200px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(0,217,118,.1)', color: 'var(--accent)' }}>
                          {tx.notes}
                        </span>
                      ) : (
                        <span className="text-xs opacity-0 group-hover/notes:opacity-40 transition-opacity">+ nota</span>
                      )}
                      {tx.notes && <Pencil size={10} className="opacity-0 group-hover/notes:opacity-60 transition-opacity flex-shrink-0" />}
                    </button>
                  )}
                </div>

                <span className="text-sm font-medium text-right tabular-nums"
                  style={{ color: tx.isTransfer ? 'var(--muted)' : tx.amount < 0 ? 'var(--negative)' : 'var(--positive)' }}>
                  {fmt(tx.amount)}
                </span>

                <div className="text-center">
                  {editingId === tx.id ? (
                    <select autoFocus defaultValue={tx.category?.id ?? ''}
                      onBlur={(e) => updateCategory(tx.id, e.target.value)}
                      onChange={(e) => updateCategory(tx.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded outline-none w-full"
                      style={{ background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                      <option value="">Sin categoría</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEditingId(tx.id)}
                      className="text-xs px-2 py-1 rounded-full transition-opacity hover:opacity-80"
                      style={{
                        background: tx.category?.color ? `${tx.category.color}33` : 'var(--card-border)',
                        color: tx.category?.color ?? 'var(--muted)',
                      }}>
                      {tx.category
                        ? (tx.category.parent
                          ? <><span style={{ opacity: 0.6 }}>{tx.category.parent.name} ›</span> {tx.category.name}</>
                          : tx.category.name)
                        : 'Sin categoría'}
                    </button>
                  )}
                  {!tx.isTransfer && tx.amount < 0 && (
                    <div className="text-[10px] mt-1" style={{ color: isFixedExpense(tx.category) ? 'var(--accent)' : 'var(--muted)' }}>
                      {isFixedExpense(tx.category) ? 'Fijo' : 'Variable'}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(tx)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}
                    title="Editar transacción">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteTransaction(tx.id, tx.description)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors text-red-400"
                    title="Eliminar transacción">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile card list ── */}
      <div className="md:hidden space-y-2">
        {loading && <div className="py-12 text-center" style={{ color: 'var(--muted)' }}>Cargando...</div>}
        {!loading && transactions.length === 0 && (
          <div className="py-12 text-center" style={{ color: 'var(--muted)' }}>No hay transacciones con estos filtros</div>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="card px-4 py-3 space-y-2">
            {/* Top row: date + amount */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs tabular-nums mt-0.5" style={{ color: 'var(--muted)' }}>
                {format(new Date(tx.date), 'dd MMM yyyy')}
              </span>
              <span className="text-base font-semibold tabular-nums flex-shrink-0"
                style={{ color: tx.isTransfer ? 'var(--muted)' : tx.amount < 0 ? 'var(--negative)' : 'var(--positive)' }}>
                {fmt(tx.amount)}
              </span>
            </div>

            {/* Description */}
            <div>
              <div className="text-sm font-medium leading-snug">{tx.description}</div>
            </div>

            {/* Bottom row: category pill */}
            <div className="flex items-center gap-2">
              {editingId === tx.id ? (
                <select autoFocus defaultValue={tx.category?.id ?? ''}
                  onBlur={(e) => updateCategory(tx.id, e.target.value)}
                  onChange={(e) => updateCategory(tx.id, e.target.value)}
                  className="text-xs px-2 py-1 rounded outline-none flex-1"
                  style={{ background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <button onClick={() => setEditingId(tx.id)}
                  className="text-xs px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 flex-shrink-0 max-w-[120px] truncate"
                  style={{
                    background: tx.category?.color ? `${tx.category.color}33` : 'var(--card-border)',
                    color: tx.category?.color ?? 'var(--muted)',
                  }}>
                  {tx.category
                    ? (tx.category.parent
                      ? <><span style={{ opacity: 0.6 }}>{tx.category.parent.name} ›</span> {tx.category.name}</>
                      : tx.category.name)
                    : 'Sin categoría'}
                </button>
              )}
              {!tx.isTransfer && tx.amount < 0 && (
                <span className="text-[10px] flex-shrink-0" style={{ color: isFixedExpense(tx.category) ? 'var(--accent)' : 'var(--muted)' }}>
                  {isFixedExpense(tx.category) ? 'Fijo' : 'Variable'}
                </span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                <button onClick={() => openEditModal(tx)}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}
                  title="Editar transacción">
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteTransaction(tx.id, tx.description)}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-red-400"
                  title="Eliminar transacción">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Notes */}
            {tx.notes && (
              <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(0,217,118,.07)', color: 'var(--accent)' }}>
                {tx.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm px-1" style={{ color: 'var(--muted)' }}>
        <span className="text-xs">{total} transacciones{filterMonth || filterCategory || q ? ' · filtradas' : ''}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"><ChevronLeft size={15} /></button>
            <span className="px-1 text-xs">{page}/{totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {/* ── FAB: mobile only, fixed above bottom nav ── */}
      <button
        onClick={openNewModal}
        className="md:hidden fixed right-4 z-40 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          bottom: '76px',
          width: '52px',
          height: '52px',
          background: 'var(--accent)',
          color: '#fff',
        }}
        aria-label="Nueva transacción"
      >
        <Plus size={22} />
      </button>

      {/* New transaction modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false) }}>
          <div className="card w-full md:max-w-md p-6 space-y-4 rounded-t-2xl md:rounded-xl"
            style={{ background: 'var(--card)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{editTxId ? 'Editar transacción' : 'Nueva transacción'}</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:opacity-60"><X size={18} /></button>
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
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                    style={INPUT_STYLE} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Importe (€)</label>
                  <input required type="number" step="0.01" min="0" placeholder="0,00"
                    value={newAmount} onChange={e => setNewAmount(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
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
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                  style={INPUT_STYLE} />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Categoría</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                  style={INPUT_STYLE}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.parent ? `${c.parent.name} › ` : ''}{c.name}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Notas (opcional)</label>
                <input type="text" placeholder="Notas adicionales..."
                  value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
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
