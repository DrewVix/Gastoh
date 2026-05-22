'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, ArrowLeft, FileText, CheckCircle, Zap } from 'lucide-react'

interface Account { id: string; bank: string; displayName: string; color: string | null }

type Step = 'upload' | 'mapping' | 'preview' | 'done'

interface ParsedRow { [key: string]: string }
interface MappedTx {
  date: string
  description: string
  amount: number
  externalId?: string
  mccCode?: string
  trType?: string
}

const DATE_HINTS = ['fecha', 'date', 'fecha valor', 'fecha operacion', 'value date', 'booking date', 'trade date', 'buchungsdatum']
const DESC_HINTS = ['concepto', 'description', 'descripcion', 'movimiento', 'details', 'reference', 'merchant', 'comercio', 'detalle', 'tipo', 'name', 'verwendungszweck']
const AMT_HINTS = ['importe', 'amount', 'cantidad', 'valor', 'saldo parcial', 'cargo/abono', 'total', 'net', 'betrag']
const CREDIT_HINTS = ['abono', 'credit', 'entrada', 'ingreso', 'haber', 'gutschrift']
const DEBIT_HINTS = ['cargo', 'debit', 'salida', 'gasto', 'debe', 'lastschrift']

// Trade Republic CSV signature columns
const TR_SIGNATURE = ['transaction_id', 'mcc_code', 'asset_class']

function isTradeRepublic(headers: string[]) {
  const lc = headers.map(h => h.toLowerCase().trim())
  return TR_SIGNATURE.every(sig => lc.includes(sig))
}


// Skip leading title rows (rows with < 3 non-empty cells are likely titles/metadata)
function findHeaderRow(data: string[][]): number {
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const nonEmpty = (data[i] ?? []).filter(c => c != null && String(c).trim() !== '').length
    if (nonEmpty >= 3) return i
  }
  return 0
}

function detect(headers: string[], hints: string[]) {
  const lc = headers.map(h => h.toLowerCase().trim())
  for (const hint of hints) {
    const i = lc.findIndex(h => h === hint || h.includes(hint))
    if (i !== -1) return headers[i]
  }
  return ''
}

function detectExact(headers: string[], name: string) {
  return headers.find(h => h.toLowerCase().trim() === name) ?? ''
}

function parseAmt(v: string): number {
  if (!v || v.trim() === '' || v.trim() === '-') return NaN
  let s = v.trim().replace(/[€$£\s]/g, '')
  const neg = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'))
  s = s.replace(/[()]/g, '').replace(/^-/, '')
  if (/^\d{1,3}(\.\d{3})+(,\d*)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d+(,\d+)?$/.test(s) && s.includes(',')) s = s.replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = parseFloat(s)
  return neg ? -Math.abs(n) : n
}

function parseDate(v: string): string {
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (m) {
    const yr = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return s
}

function ColSelect({ label, value, onChange, headers, required = true, optional = false }: {
  label: string; value: string; onChange: (v: string) => void; headers: string[]; required?: boolean; optional?: boolean
}) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {optional && <span className="ml-1 text-xs opacity-60">(opcional)</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
      >
        <option value="">— sin mapear —</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  )
}

export default function ImportClient() {
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [dateCol, setDateCol] = useState('')
  const [descCol, setDescCol] = useState('')
  const [descFallbackCol, setDescFallbackCol] = useState('')
  const [amtCol, setAmtCol] = useState('')
  const [splitMode, setSplitMode] = useState(false)
  const [creditCol, setCreditCol] = useState('')
  const [debitCol, setDebitCol] = useState('')
  const [externalIdCol, setExternalIdCol] = useState('')
  const [mccCol, setMccCol] = useState('')
  const [typeCol, setTypeCol] = useState('')
  const [preview, setPreview] = useState<MappedTx[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [isTR, setIsTR] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/accounts').then((r) => r.json()).then(setAccounts)
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setFileName(file.name)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', raw: false, dateNF: 'yyyy-mm-dd' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

      const headerRow = findHeaderRow(data)
      const hdrs = (data[headerRow] ?? []).map(h => String(h ?? '').trim()).filter(Boolean)
      if (!hdrs.length) { setError('No se encontraron columnas en el archivo.'); return }

      const body = data
        .slice(headerRow + 1)
        .filter(row => row.some(c => c != null && c !== ''))
        .map(row => Object.fromEntries(hdrs.map((h, i) => [h, String(row[i] ?? '').trim()])))

      setHeaders(hdrs)
      setRows(body)

      const tr = isTradeRepublic(hdrs)
      setIsTR(tr)

      if (tr) {
        // Auto-map all Trade Republic columns
        setDateCol(detectExact(hdrs, 'date'))
        setDescCol(detectExact(hdrs, 'name'))
        setDescFallbackCol(detectExact(hdrs, 'description'))
        setAmtCol(detectExact(hdrs, 'amount'))
        setExternalIdCol(detectExact(hdrs, 'transaction_id'))
        setMccCol(detectExact(hdrs, 'mcc_code'))
        setTypeCol(detectExact(hdrs, 'type'))
        setSplitMode(false)
        setShowAdvanced(true)
      } else {
        const detectedAmt = detect(hdrs, AMT_HINTS)
        const detectedCredit = detect(hdrs, CREDIT_HINTS)
        const detectedDebit = detect(hdrs, DEBIT_HINTS)
        setDateCol(detect(hdrs, DATE_HINTS))
        setDescCol(detect(hdrs, DESC_HINTS))
        setDescFallbackCol('')
        setAmtCol(detectedAmt)
        setCreditCol(detectedCredit)
        setDebitCol(detectedDebit)
        setSplitMode(!detectedAmt && !!(detectedCredit || detectedDebit))
        setExternalIdCol('')
        setMccCol('')
        setTypeCol('')
      }

      setStep('mapping')
    } catch {
      setError('No se pudo leer el archivo. Asegúrate de que es un CSV o Excel válido.')
    }
  }, [])

  function buildPreview(): MappedTx[] {
    return rows.flatMap(row => {
      const rawDate = row[dateCol] ?? ''
      const rawDesc = row[descCol] ?? ''
      const fallback = descFallbackCol ? (row[descFallbackCol] ?? '') : ''
      // Para Trade Republic: si name y description están vacíos (ej. INTEREST_PAYMENT),
      // usar el tipo como descripción para que no se descarte la fila
      const typeVal = typeCol ? (row[typeCol] ?? '') : ''
      const desc = rawDesc || fallback || typeVal
      let amt: number

      if (splitMode) {
        const credit = parseAmt(row[creditCol] ?? '')
        const debit = parseAmt(row[debitCol] ?? '')
        if (!isNaN(credit) && credit !== 0) amt = Math.abs(credit)
        else if (!isNaN(debit) && debit !== 0) amt = -Math.abs(debit)
        else return []
      } else {
        amt = parseAmt(row[amtCol] ?? '')
      }

      if (!rawDate || !desc || isNaN(amt)) return []

      const tx: MappedTx = { date: parseDate(rawDate), description: desc, amount: amt }
      if (externalIdCol && row[externalIdCol]) tx.externalId = row[externalIdCol]
      if (mccCol && row[mccCol]) tx.mccCode = row[mccCol]
      if (typeCol && row[typeCol]) tx.trType = row[typeCol]
      return [tx]
    })
  }

  function goPreview() {
    const hasAmt = splitMode ? (creditCol || debitCol) : amtCol
    if (!dateCol || !descCol || !hasAmt) { setError('Selecciona las columnas requeridas.'); return }
    const p = buildPreview()
    if (!p.length) { setError('No se pudieron parsear transacciones. Revisa el mapeo.'); return }
    setError('')
    setPreview(p)
    setStep('preview')
  }

  async function doImport() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: preview, accountId: accountId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al importar')
      setResult(data)
      setStep('done')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep('upload'); setHeaders([]); setRows([]); setPreview([])
    setResult(null); setError(''); setFileName(''); setIsTR(false); setShowAdvanced(false)
  }

  if (step === 'upload') return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Importar transacciones</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
        Fallback para cuando la sincronización automática no esté disponible. Exporta el CSV desde Trade Republic y súbelo aquí.
      </p>

      <div className="grid gap-6 items-start grid-cols-1 md:grid-cols-[1fr_280px]">
        {/* Zona principal */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Cuenta de origen</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            >
              <option value="">Sin especificar</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
            </select>
            {accounts.length === 0 && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                Configura tus cuentas en <a href="/settings" className="underline">Ajustes</a>.
              </p>
            )}
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border-2 border-dashed py-12 md:py-16 text-center cursor-pointer transition-colors"
            style={{
              borderColor: dragging ? 'var(--accent)' : 'var(--card-border)',
              background: dragging ? 'rgba(99,102,241,.06)' : 'transparent',
            }}
          >
            <Upload className="mx-auto mb-3" size={36} style={{ color: 'var(--muted)' }} />
            <p className="text-sm font-medium">Arrastra aquí o toca para seleccionar</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>.csv · .xlsx · .xls</p>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
              className="mt-4 px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              Seleccionar archivo
            </button>
            <input
              ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Panel de ayuda */}
        <div className="space-y-3">
          <div className="card p-4 space-y-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Formatos</div>
            <div className="flex items-center justify-between text-xs">
              <span>Trade Republic CSV</span>
              <span className="text-green-400">Detección automática</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Cualquier CSV/Excel</span>
              <span style={{ color: 'var(--muted)' }}>Mapeo manual</span>
            </div>
          </div>
          <div className="card p-4 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Formatos</div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              CSV (cualquier separador), Excel .xlsx y .xls. La deduplicación es automática — puedes importar el mismo archivo varias veces sin duplicados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 'mapping') return (
    <div>
      <button onClick={() => setStep('upload')} className="flex items-center gap-1 text-sm mb-5" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={14} /> Volver
      </button>
      <div className="flex items-center gap-2 mb-1">
        <FileText size={15} style={{ color: 'var(--muted)' }} />
        <span className="text-sm font-medium">{fileName}</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>({rows.length} filas)</span>
      </div>
      <h2 className="text-xl font-semibold mb-4">Mapear columnas</h2>

      {/* Bank format banners */}
      {isTR && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4 text-sm"
          style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)', color: '#a5b4fc' }}>
          <Zap size={14} />
          <span>Formato <strong>Trade Republic</strong> detectado — columnas mapeadas automáticamente, incluyendo MCC y tipo de transacción.</span>
        </div>
      )}

      <div className="card p-5 space-y-4 mb-4">
        <ColSelect label="Fecha" value={dateCol} onChange={setDateCol} headers={headers} />
        <ColSelect label="Descripción / Concepto" value={descCol} onChange={setDescCol} headers={headers} />
        <ColSelect label="Descripción alternativa (si la principal está vacía)" value={descFallbackCol} onChange={setDescFallbackCol} headers={headers} required={false} optional />

        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-3" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={splitMode} onChange={e => setSplitMode(e.target.checked)} className="accent-indigo-500" />
            El banco usa columnas separadas para cargo y abono
          </label>
          {splitMode ? (
            <div className="grid grid-cols-2 gap-3">
              <ColSelect label="Abono / Entrada (+)" value={creditCol} onChange={setCreditCol} headers={headers} required={false} />
              <ColSelect label="Cargo / Salida (−)" value={debitCol} onChange={setDebitCol} headers={headers} required={false} />
            </div>
          ) : (
            <ColSelect label="Importe" value={amtCol} onChange={setAmtCol} headers={headers} />
          )}
        </div>

        {/* Advanced / enrichment columns */}
        <div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--muted)' }}
          >
            {showAdvanced ? '▾' : '▸'} Campos de categorización avanzada
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3 pl-3" style={{ borderLeft: '2px solid var(--card-border)' }}>
              <ColSelect label="ID externo (para evitar duplicados)" value={externalIdCol} onChange={setExternalIdCol} headers={headers} required={false} optional />
              <ColSelect label="Código MCC (categoría del comercio)" value={mccCol} onChange={setMccCol} headers={headers} required={false} optional />
              <ColSelect label="Tipo de transacción (ej: INTEREST_PAYMENT)" value={typeCol} onChange={setTypeCol} headers={headers} required={false} optional />
            </div>
          )}
        </div>

        {/* Raw data preview */}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg -mx-1" style={{ border: '1px solid var(--card-border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid var(--card-border)' }}>
                  {headers.map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    {headers.map(h => (
                      <td key={h} className="px-2 py-1.5 max-w-28 truncate">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <button
        onClick={goPreview}
        className="w-full py-2 px-4 rounded-lg text-sm font-medium"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        Siguiente →
      </button>
    </div>
  )

  if (step === 'preview') return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => setStep('mapping')} className="flex items-center gap-1 text-sm mb-5" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={14} /> Volver
      </button>
      <h2 className="text-xl font-semibold mb-1">Preview</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
        {preview.length} transacciones listas para importar
        {preview.some(t => t.mccCode) && (
          <span className="ml-2 text-indigo-400">· con código MCC</span>
        )}
      </p>

      <div className="card overflow-hidden mb-4">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '400px' }}>
          <table className="w-full text-sm min-w-[400px]">
            <thead className="sticky top-0" style={{ background: 'var(--card)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>Fecha</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>Descripción</th>
                {preview.some(t => t.mccCode) && (
                  <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>MCC</th>
                )}
                {preview.some(t => t.trType) && (
                  <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>Tipo</th>
                )}
                <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((tx, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{tx.date}</td>
                  <td className="px-4 py-2 text-xs max-w-xs truncate">{tx.description}</td>
                  {preview.some(t => t.mccCode) && (
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--muted)' }}>{tx.mccCode || '—'}</td>
                  )}
                  {preview.some(t => t.trType) && (
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--muted)' }}>{tx.trType || '—'}</td>
                  )}
                  <td className={`px-4 py-2 text-xs text-right font-mono ${tx.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <button
        onClick={doImport}
        disabled={loading}
        className="w-full py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {loading ? 'Importando...' : `Importar ${preview.length} transacciones`}
      </button>
    </div>
  )

  return (
    <div className="max-w-md mx-auto text-center py-16">
      <CheckCircle className="mx-auto mb-4 text-green-400" size={52} />
      <h2 className="text-xl font-semibold mb-3">Importación completada</h2>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        <span className="text-green-400 font-semibold">{result?.imported}</span> transacciones importadas
        {(result?.skipped ?? 0) > 0 && (
          <> · <span className="font-semibold">{result?.skipped}</span> ya existían</>
        )}
      </p>
      <div className="flex gap-3 justify-center mt-8">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          Importar otro archivo
        </button>
        <a
          href="/transactions"
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Ver transacciones →
        </a>
      </div>
    </div>
  )
}
