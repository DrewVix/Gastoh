'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { X } from 'lucide-react'

export interface Refund {
  id: string
  date: string
  amount: number
  description: string
  notes: string | null
}

export interface RefundParent {
  id: string
  description: string
  amount: number
  refunded: number
}

interface RefundFormModalProps {
  parent: RefundParent | null
  editRefund?: Refund | null
  onClose: () => void
  onSaved: () => void
}

const INPUT_STYLE = { background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

function fmt(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

export default function RefundFormModal({ parent, editRefund, onClose, onSaved }: RefundFormModalProps) {
  if (!parent) return null
  // key fuerza un remount (y el reset del formulario) al cambiar de gasto o de devolución.
  return <RefundForm key={`${parent.id}-${editRefund?.id ?? 'new'}`} parent={parent} editRefund={editRefund} onClose={onClose} onSaved={onSaved} />
}

function RefundForm({ parent, editRefund, onClose, onSaved }: RefundFormModalProps & { parent: RefundParent }) {
  // Pendiente de devolver, sin contar la devolución que se está editando.
  const pending = Math.round((Math.abs(parent.amount) - parent.refunded + (editRefund?.amount ?? 0)) * 100) / 100
  const [date, setDate] = useState(editRefund ? editRefund.date.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'))
  const [amount, setAmount] = useState(editRefund ? String(editRefund.amount) : '')
  const [desc, setDesc] = useState(editRefund?.description ?? `Devolución · ${parent.description}`)
  const [notes, setNotes] = useState(editRefund?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !amount || !desc.trim()) return
    setSaving(true)
    setError(null)
    const body = {
      date,
      amount: Math.abs(parseFloat(amount)),
      description: desc.trim(),
      notes: notes.trim() || null,
      ...(!editRefund && { refundOfId: parent.id }),
    }
    const res = await fetch(editRefund ? `/api/transactions/${editRefund.id}` : '/api/transactions', {
      method: editRefund ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'No se pudo guardar la devolución')
      return
    }
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
          <h2 className="text-base font-semibold">{editRefund ? 'Editar devolución' : 'Añadir devolución'}</h2>
          <button onClick={onClose} className="p-2 -m-2 hover:opacity-60" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
          <div className="truncate" style={{ color: 'var(--foreground)' }}>{parent.description}</div>
          <div className="mt-0.5">
            Gasto {fmt(Math.abs(parent.amount))} · pendiente de devolver {fmt(pending)}
          </div>
          <div className="mt-1">Se resta del gasto y no cuenta como ingreso.</div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Fecha</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full text-base px-3 py-2.5 rounded-lg outline-none" style={INPUT_STYLE} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Importe (€)</label>
              <input required autoFocus type="number" step="0.01" min="0.01" max={pending} placeholder="0,00"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full text-base px-3 py-2.5 rounded-lg outline-none" style={INPUT_STYLE} />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Concepto *</label>
            <input required type="text" placeholder="Ej: Bizum de Ana"
              value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full text-base px-3 py-2.5 rounded-lg outline-none" style={INPUT_STYLE} />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Notas (opcional)</label>
            <input type="text" placeholder="Notas adicionales..."
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full text-base px-3 py-2.5 rounded-lg outline-none" style={INPUT_STYLE} />
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}

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
