'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import CategoryOptions, { type Category } from './CategorySelectOptions'

export interface EditableTransaction {
  id: string
  date: string
  description: string
  amount: number
  notes: string | null
  isTransfer: boolean
  category: { id: string } | null
}

interface TransactionFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editTx?: EditableTransaction | null
}

const INPUT_STYLE = { background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

export default function TransactionFormModal({ open, onClose, onSaved, editTx }: TransactionFormModalProps) {
  if (!open) return null
  // key fuerza un remount (y por tanto el reset del formulario) al pasar de crear a editar u otra transacción.
  return <TransactionForm key={editTx?.id ?? 'new'} onClose={onClose} onSaved={onSaved} editTx={editTx} />
}

function TransactionForm({ onClose, onSaved, editTx }: Omit<TransactionFormModalProps, 'open'>) {
  const [categories, setCategories] = useState<Category[]>([])
  const [date, setDate] = useState(editTx ? editTx.date.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'))
  const [amount, setAmount] = useState(editTx ? String(Math.abs(editTx.amount)) : '')
  const [type, setType] = useState<'gasto' | 'ingreso'>(editTx ? (editTx.amount < 0 ? 'gasto' : 'ingreso') : 'gasto')
  const [desc, setDesc] = useState(editTx?.description ?? '')
  const [category, setCategory] = useState(editTx?.category?.id ?? '')
  const [notes, setNotes] = useState(editTx?.notes ?? '')
  const [isTransfer, setIsTransfer] = useState(editTx?.isTransfer ?? false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d?.flat ?? []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !amount || !desc.trim()) return
    setSaving(true)
    const sign = type === 'gasto' ? -1 : 1
    const body = {
      date,
      amount: sign * Math.abs(parseFloat(amount)),
      description: desc.trim(),
      categoryId: category || null,
      notes: notes.trim() || null,
      isTransfer,
    }
    await fetch(editTx ? `/api/transactions/${editTx.id}` : '/api/transactions', {
      method: editTx ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card w-full md:max-w-md p-6 space-y-4 rounded-t-2xl md:rounded-xl"
        style={{ background: 'var(--card)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{editTx ? 'Editar transacción' : 'Nueva transacción'}</h2>
          <button onClick={onClose} className="p-2 -m-2 hover:opacity-60" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* Type toggle */}
          <div className="flex rounded-lg overflow-hidden text-sm" style={{ border: '1px solid var(--card-border)' }}>
            {(['gasto', 'ingreso'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setType(t)}
                className="flex-1 py-2 capitalize transition-colors"
                style={{
                  background: type === t ? (t === 'gasto' ? 'var(--negative)' : 'var(--positive)') : 'transparent',
                  color: type === t ? '#fff' : 'var(--muted)',
                }}>
                {t === 'gasto' ? 'Gasto' : 'Ingreso'}
              </button>
            ))}
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Fecha</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
                style={INPUT_STYLE} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Importe (€)</label>
              <input required type="number" step="0.01" min="0" placeholder="0,00"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
                style={INPUT_STYLE} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              {type === 'gasto' ? 'Descripción *' : 'Concepto *'}
            </label>
            <input required type="text"
              placeholder={type === 'gasto' ? 'Ej: Compra en Mercadona' : 'Ej: Nómina, Bizum de un amigo'}
              value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
              style={INPUT_STYLE} />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
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
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full text-base px-3 py-2.5 rounded-lg outline-none"
              style={INPUT_STYLE} />
          </div>

          {/* Transfer */}
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={isTransfer} onChange={e => setIsTransfer(e.target.checked)}
              className="accent-current" style={{ accentColor: 'var(--accent)' }} />
            Es una transferencia entre cuentas (no cuenta como gasto ni ingreso real)
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 text-sm py-2.5 rounded-lg transition-colors hover:opacity-80"
              style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 text-sm py-2.5 rounded-lg transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
