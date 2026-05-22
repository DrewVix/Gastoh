'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { Search, ChevronLeft, ChevronRight, Pencil, Check, X, Plus, Store, SlidersHorizontal } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  parentId: string | null
  parent: { id: string; name: string; color: string | null; icon: string | null } | null
}
interface Transaction {
  id: string
  date: string
  description: string
  merchantName: string | null
  amount: number
  currency: string
  isManual: boolean
  isTransfer: boolean
  notes: string | null
  category: Category | null
  bankAccount: { bank: string; displayName: string } | null
}

function fmt(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

const INPUT_STYLE = { background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

interface Merchant {
  name: string
  count: number
  total: number
}

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterMerchant, setFilterMerchant] = useState('')
  const [merchantSearch, setMerchantSearch] = useState('')
  const [merchantDropdown, setMerchantDropdown] = useState(false)
  const [merchantTotal, setMerchantTotal] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const merchantRef = useRef<HTMLDivElement>(null)

  // Mobile filter panel state
  const [showFilters, setShowFilters] = useState(false)

  // Notes editing
  const [editNotesId, setEditNotesId] = useState<string | null>(null)
  const [editNotesValue, setEditNotesValue] = useState('')

  // Merchant editing
  const [editMerchantId, setEditMerchantId] = useState<string | null>(null)
  const [editMerchantValue, setEditMerchantValue] = useState('')

  // New transaction modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newType, setNewType] = useState<'gasto' | 'ingreso'>('gasto')
  const [newDesc, setNewDesc] = useState('')
  const [newMerchant, setNewMerchant] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newNotes, setNewNotes] = useState('')
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
      ...(filterMerchant && { merchant: filterMerchant }),
      excludeTransfers: '1',
    })
    const res = await fetch(`/api/transactions?${params}`)
    const data = await res.json()
    setTransactions(data.transactions ?? [])
    setTotal(data.total ?? 0)
    setMerchantTotal(data.merchantTotal ?? null)
    setLoading(false)
  }, [page, q, filterCategory, filterMonth, filterMerchant])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d?.flat ?? []))
    fetch('/api/merchants').then((r) => r.json()).then((d) => setMerchants(Array.isArray(d) ? d : []))
  }, [])

  // Close merchant dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (merchantRef.current && !merchantRef.current.contains(e.target as Node)) {
        setMerchantDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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

  async function saveMerchant(id: string) {
    await patch(id, { merchantName: editMerchantValue.trim() || null })
    setEditMerchantId(null)
  }

  const totalPages = Math.ceil(total / limit)

  function openNewModal() {
    setNewDate(format(new Date(), 'yyyy-MM-dd'))
    setNewAmount('')
    setNewType('gasto')
    setNewDesc('')
    setNewMerchant('')
    setNewCategory('')
    setNewNotes('')
    setShowNewModal(true)
  }

  async function createTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate || !newAmount || !newDesc.trim()) return
    setNewSaving(true)
    const sign = newType === 'gasto' ? -1 : 1
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: newDate,
        amount: sign * Math.abs(parseFloat(newAmount)),
        description: newDesc.trim(),
        merchantName: newMerchant.trim() || null,
        categoryId: newCategory || null,
        notes: newNotes.trim() || null,
      }),
    })
    setNewSaving(false)
    setShowNewModal(false)
    load()
  }

  const SEL = { background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

  // Count active filters for badge
  const activeFilterCount = [q, filterCategory, filterMonth, filterMerchant].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      {/* Desktop toolbar */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold mr-1">Gastos</h1>

        <div className="flex items-center gap-2 w-52"
          style={{ background: '#0f1117', border: '1px solid var(--card-border)', borderRadius: 8, padding: '5px 10px' }}>
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

        {/* Merchant filter */}
        <div ref={merchantRef} className="relative">
          {filterMerchant ? (
            <button
              onClick={() => { setFilterMerchant(''); setMerchantSearch(''); setPage(1) }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.4)', color: '#818cf8' }}>
              <Store size={13} />
              {filterMerchant}
              <X size={12} className="ml-0.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2"
              style={{ background: '#0f1117', border: '1px solid var(--card-border)', borderRadius: 8, padding: '5px 10px' }}>
              <Store size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Comercio..."
                value={merchantSearch}
                onChange={(e) => { setMerchantSearch(e.target.value); setMerchantDropdown(true) }}
                onFocus={() => setMerchantDropdown(true)}
                className="text-sm bg-transparent outline-none w-32"
              />
            </div>
          )}
          {merchantDropdown && !filterMerchant && (
            <div className="absolute top-full mt-1 left-0 z-30 rounded-lg overflow-hidden shadow-xl"
              style={{ background: 'var(--card)', border: '1px solid var(--card-border)', minWidth: 220, maxHeight: 260, overflowY: 'auto' }}>
              {merchants
                .filter(m => !merchantSearch || m.name.toLowerCase().includes(merchantSearch.toLowerCase()))
                .slice(0, 30)
                .map(m => (
                  <button key={m.name}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors text-left"
                    onClick={() => { setFilterMerchant(m.name); setMerchantSearch(''); setMerchantDropdown(false); setPage(1) }}>
                    <span className="truncate flex-1">{m.name}</span>
                    <span className="text-xs ml-2 tabular-nums flex-shrink-0" style={{ color: 'var(--muted)' }}>
                      {m.count} · {fmt(m.total)}
                    </span>
                  </button>
                ))}
              {merchants.filter(m => !merchantSearch || m.name.toLowerCase().includes(merchantSearch.toLowerCase())).length === 0 && (
                <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--muted)' }}>Sin resultados</div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={openNewModal}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Plus size={14} />
          Nueva
        </button>
      </div>

      {/* Mobile toolbar */}
      <div className="flex md:hidden items-center gap-2">
        <h1 className="text-lg font-semibold flex-1">Gastos</h1>
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg relative"
          style={{
            background: activeFilterCount > 0 ? 'rgba(99,102,241,.15)' : 'var(--card)',
            border: `1px solid ${activeFilterCount > 0 ? 'rgba(99,102,241,.4)' : 'var(--card-border)'}`,
            color: activeFilterCount > 0 ? '#818cf8' : 'var(--muted)',
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
            style={{ background: '#0f1117', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px' }}>
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

          {filterMerchant ? (
            <button
              onClick={() => { setFilterMerchant(''); setMerchantSearch(''); setPage(1) }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.4)', color: '#818cf8' }}>
              <span className="flex items-center gap-2"><Store size={13} />{filterMerchant}</span>
              <X size={12} />
            </button>
          ) : (
            <div ref={merchantRef} className="relative">
              <div className="flex items-center gap-2"
                style={{ background: '#0f1117', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px' }}>
                <Store size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Filtrar por comercio..."
                  value={merchantSearch}
                  onChange={(e) => { setMerchantSearch(e.target.value); setMerchantDropdown(true) }}
                  onFocus={() => setMerchantDropdown(true)}
                  className="flex-1 text-sm bg-transparent outline-none"
                />
              </div>
              {merchantDropdown && !filterMerchant && merchantSearch && (
                <div className="absolute top-full mt-1 left-0 right-0 z-30 rounded-lg overflow-hidden shadow-xl"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)', maxHeight: 200, overflowY: 'auto' }}>
                  {merchants
                    .filter(m => !merchantSearch || m.name.toLowerCase().includes(merchantSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(m => (
                      <button key={m.name}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/[0.06] transition-colors text-left"
                        onClick={() => { setFilterMerchant(m.name); setMerchantSearch(''); setMerchantDropdown(false); setPage(1) }}>
                        <span className="truncate flex-1">{m.name}</span>
                        <span className="text-xs ml-2 tabular-nums flex-shrink-0" style={{ color: 'var(--muted)' }}>
                          {m.count} · {fmt(m.total)}
                        </span>
                      </button>
                    ))}
                  {merchants.filter(m => !merchantSearch || m.name.toLowerCase().includes(merchantSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--muted)' }}>Sin resultados</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setQ(''); setFilterCategory(''); setFilterMonth(''); setFilterMerchant(''); setMerchantSearch(''); setPage(1) }}
              className="w-full text-sm py-2 rounded-lg"
              style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Merchant banner */}
      {filterMerchant && merchantTotal !== null && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm flex-wrap"
          style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)' }}>
          <Store size={15} style={{ color: '#818cf8' }} />
          <span style={{ color: '#a5b4fc' }}><strong>{filterMerchant}</strong></span>
          <span style={{ color: 'var(--muted)' }}>·</span>
          <span style={{ color: 'var(--muted)' }}>{total} transacciones</span>
          <span style={{ color: 'var(--muted)' }}>·</span>
          <span className="font-medium tabular-nums" style={{ color: '#EF4444' }}>{fmt(-merchantTotal)}</span>
        </div>
      )}

      {/* ── Desktop Table ── */}
      <div className="hidden md:block card overflow-hidden">
        <div className="px-5 py-2.5 border-b text-xs font-semibold grid"
          style={{ borderColor: 'var(--card-border)', color: 'var(--muted)', gridTemplateColumns: '88px 1fr 140px 110px 200px' }}>
          <span>FECHA</span>
          <span>DESCRIPCIÓN</span>
          <span>CUENTA</span>
          <span className="text-right">IMPORTE</span>
          <span className="text-center">CATEGORÍA</span>
        </div>

        {loading && <div className="py-12 text-center" style={{ color: 'var(--muted)' }}>Cargando...</div>}
        {!loading && transactions.length === 0 && (
          <div className="py-12 text-center" style={{ color: 'var(--muted)' }}>No hay transacciones con estos filtros</div>
        )}

        <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
          {transactions.map((tx) => (
            <div key={tx.id}>
              {/* Main row */}
              <div className="px-5 py-3 grid items-center gap-2 hover:bg-white/[0.025] transition-colors"
                style={{ gridTemplateColumns: '88px 1fr 140px 110px 200px' }}>
                <div>
                  <div className="text-xs font-medium tabular-nums">{format(new Date(tx.date), 'dd MMM')}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{format(new Date(tx.date), 'yyyy')}</div>
                </div>

                {/* Description + merchant + notes */}
                <div className="min-w-0">
                  <div className="text-sm truncate">{tx.description}</div>

                  {/* Merchant: editable */}
                  {!tx.isTransfer && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {editMerchantId === tx.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            autoFocus
                            type="text"
                            value={editMerchantValue}
                            onChange={e => setEditMerchantValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveMerchant(tx.id); if (e.key === 'Escape') setEditMerchantId(null) }}
                            className="text-xs px-2 py-0.5 rounded outline-none flex-1"
                            style={INPUT_STYLE}
                            placeholder="Nombre del comercio"
                          />
                          <button onClick={() => saveMerchant(tx.id)} className="p-0.5 text-green-400"><Check size={12} /></button>
                          <button onClick={() => setEditMerchantId(null)} className="p-0.5" style={{ color: 'var(--muted)' }}><X size={12} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditMerchantId(tx.id); setEditMerchantValue(tx.merchantName ?? '') }}
                          className="flex items-center gap-1 group/merchant"
                          style={{ color: 'var(--muted)' }}
                        >
                          <span className="text-xs truncate max-w-[200px]">
                            {tx.merchantName ?? <span className="opacity-40">+ comercio</span>}
                          </span>
                          <Pencil size={10} className="opacity-0 group-hover/merchant:opacity-60 transition-opacity flex-shrink-0" />
                        </button>
                      )}
                    </div>
                  )}

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
                          style={{ background: 'rgba(99,102,241,.1)', color: '#818cf8' }}>
                          {tx.notes}
                        </span>
                      ) : (
                        <span className="text-xs opacity-0 group-hover/notes:opacity-40 transition-opacity">+ nota</span>
                      )}
                      {tx.notes && <Pencil size={10} className="opacity-0 group-hover/notes:opacity-60 transition-opacity flex-shrink-0" />}
                    </button>
                  )}
                </div>

                <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                  {tx.bankAccount?.displayName ?? 'Importado'}
                </span>

                <span className="text-sm font-medium text-right tabular-nums"
                  style={{ color: tx.isTransfer ? 'var(--muted)' : tx.amount < 0 ? '#EF4444' : '#22C55E' }}>
                  {fmt(tx.amount)}
                </span>

                <div className="text-center">
                  {editingId === tx.id ? (
                    <select autoFocus defaultValue={tx.category?.id ?? ''}
                      onBlur={(e) => updateCategory(tx.id, e.target.value)}
                      onChange={(e) => updateCategory(tx.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded outline-none w-full"
                      style={{ background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
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
                style={{ color: tx.isTransfer ? 'var(--muted)' : tx.amount < 0 ? '#EF4444' : '#22C55E' }}>
                {fmt(tx.amount)}
              </span>
            </div>

            {/* Description + merchant badge */}
            <div>
              <div className="text-sm font-medium leading-snug">{tx.description}</div>
              {tx.merchantName && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1"
                  style={{ background: 'rgba(99,102,241,.1)', color: '#818cf8' }}>
                  <Store size={10} />
                  {tx.merchantName}
                </span>
              )}
            </div>

            {/* Bottom row: category pill + account */}
            <div className="flex items-center justify-between gap-2">
              {editingId === tx.id ? (
                <select autoFocus defaultValue={tx.category?.id ?? ''}
                  onBlur={(e) => updateCategory(tx.id, e.target.value)}
                  onChange={(e) => updateCategory(tx.id, e.target.value)}
                  className="text-xs px-2 py-1 rounded outline-none flex-1"
                  style={{ background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <button onClick={() => setEditingId(tx.id)}
                  className="text-xs px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 flex-shrink-0"
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
              <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                {tx.bankAccount?.displayName ?? 'Importado'}
              </span>
            </div>

            {/* Notes */}
            {tx.notes && (
              <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(99,102,241,.07)', color: '#818cf8' }}>
                {tx.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm px-1" style={{ color: 'var(--muted)' }}>
        <span className="text-xs">{total} transacciones{filterMonth || filterCategory || q || filterMerchant ? ' · filtradas' : ''}</span>
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
              <h2 className="text-base font-semibold">Nueva transacción</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:opacity-60"><X size={18} /></button>
            </div>

            <form onSubmit={createTransaction} className="space-y-3">
              {/* Type toggle */}
              <div className="flex rounded-lg overflow-hidden text-sm" style={{ border: '1px solid var(--card-border)' }}>
                {(['gasto', 'ingreso'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setNewType(t)}
                    className="flex-1 py-2 capitalize transition-colors"
                    style={{
                      background: newType === t ? (t === 'gasto' ? '#EF4444' : '#22C55E') : 'transparent',
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
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Descripción *</label>
                <input required type="text" placeholder="Ej: Compra en Mercadona"
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                  style={INPUT_STYLE} />
              </div>

              {/* Merchant */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Comercio (opcional)</label>
                <input type="text" placeholder="Ej: Mercadona"
                  value={newMerchant} onChange={e => setNewMerchant(e.target.value)}
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
