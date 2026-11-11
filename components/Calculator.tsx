'use client'

import { useEffect, useState } from 'react'
import { Calculator as CalculatorIcon, X } from 'lucide-react'
import { evaluateExpression } from '@/lib/calc'

const KEYS = [
  ['C', '(', ')', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['⌫', '0', '.', '='],
]

const OPERATORS = new Set(['÷', '×', '−', '+', '(', ')'])

function toInternal(token: string) {
  if (token === '×') return '*'
  if (token === '÷') return '/'
  if (token === '−') return '-'
  return token
}

function formatResult(n: number) {
  return String(Math.round(n * 100) / 100)
}

export default function Calculator() {
  const [open, setOpen] = useState(false)
  const [expr, setExpr] = useState('')
  const [justEvaluated, setJustEvaluated] = useState(false)

  function press(token: string) {
    if (token === 'C') {
      setExpr('')
      setJustEvaluated(false)
      return
    }
    if (token === '⌫') {
      setExpr(e => e.slice(0, -1))
      setJustEvaluated(false)
      return
    }
    if (token === '=') {
      const result = evaluateExpression(expr)
      if (result !== null) setExpr(formatResult(result))
      setJustEvaluated(true)
      return
    }
    setExpr(e => (justEvaluated && !OPERATORS.has(token) ? toInternal(token) : e + toInternal(token)))
    setJustEvaluated(false)
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'Enter') { e.preventDefault(); press('='); return }
      if (e.key === 'Backspace') { press('⌫'); return }
      if (/^[0-9.+-]$/.test(e.key)) { press(e.key); return }
      if (e.key === '*') press('×')
      else if (e.key === '/') { e.preventDefault(); press('÷') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expr, justEvaluated])

  return (
    <>
      {/* Desktop trigger: icono junto al usuario en el sidebar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center justify-center p-2 rounded hover:bg-white/10 transition-colors flex-shrink-0"
        style={{ color: 'var(--muted)' }}
        aria-label="Calculadora"
        title="Calculadora">
        <CalculatorIcon size={14} />
      </button>

      {/* Mobile trigger: botón flotante, lado opuesto al FAB de "Nueva transacción" */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed left-4 z-40 flex items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
        style={{
          bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)',
          width: '48px',
          height: '48px',
          boxShadow: '0 8px 24px -8px rgba(0,0,0,.6)',
          background: 'var(--card)',
          border: '1px solid var(--card-border)',
          color: 'var(--accent)',
        }}
        aria-label="Calculadora">
        <CalculatorIcon size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="card w-full md:max-w-xs p-5 space-y-3 rounded-t-2xl md:rounded-xl"
            style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Calculadora</h2>
              <button onClick={() => setOpen(false)} className="p-2 -m-2 hover:opacity-60" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="text-right text-3xl font-semibold tabular-nums px-3 py-4 rounded-lg overflow-x-auto"
              style={{ background: '#0a0a0b', border: '1px solid var(--card-border)' }}>
              {expr || '0'}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {KEYS.flat().map((k, idx) => (
                <button key={idx} type="button" onClick={() => press(k)}
                  className="py-3 rounded-lg text-base font-medium transition-colors hover:opacity-80"
                  style={{
                    background: k === '=' ? 'var(--accent)' : (k === 'C' || k === '⌫') ? 'var(--negative-soft)' : '#0a0a0b',
                    color: k === '=' ? '#fff' : (k === 'C' || k === '⌫') ? 'var(--negative)' : OPERATORS.has(k) ? 'var(--accent)' : 'var(--foreground)',
                    border: '1px solid var(--card-border)',
                  }}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
