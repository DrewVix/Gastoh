'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Shield, KeyRound, ArrowRight } from 'lucide-react'

interface Account {
  id: string; bank: string; displayName: string; color: string | null; createdAt: string
}

interface User {
  id: string; username: string; isAdmin: boolean; createdAt: string
}

interface MerchantRow {
  name: string; count: number; total: number
}

interface MerchantRule {
  id: string; pattern: string; matchType: string; canonicalName: string; priority: number
}

function guessCanonical(raw: string): string {
  return raw
    .replace(/\s+\d+(\s+\w+)*$/, '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function matchTypeLabel(t: string) {
  return t === 'exact' ? 'exacto' : t === 'startsWith' ? 'empieza por' : 'contiene'
}

const BANKS = [
  { value: 'TRADE_REPUBLIC', label: 'Trade Republic', color: '#00b85e' },
  { value: 'OPENBANK', label: 'OpenBank', color: '#e30613' },
  { value: 'N26', label: 'N26', color: '#00bcd4' },
  { value: 'REVOLUT', label: 'Revolut', color: '#0075eb' },
  { value: 'BNEXT', label: 'Bnext', color: '#6c3ce1' },
  { value: 'MYINVESTOR', label: 'MyInvestor', color: '#f59e0b' },
  { value: 'INDEXA', label: 'Indexa Capital', color: '#2563eb' },
  { value: 'CAIXABANK', label: 'CaixaBank', color: '#006e9e' },
  { value: 'SANTANDER', label: 'Santander', color: '#ec0000' },
  { value: 'BBVA', label: 'BBVA', color: '#004481' },
  { value: 'SABADELL', label: 'Sabadell', color: '#007bc4' },
  { value: 'ING', label: 'ING', color: '#ff6200' },
  { value: 'UNICAJA', label: 'Unicaja', color: '#006d3c' },
  { value: 'OTHER', label: 'Otro', color: '#6b7280' },
]

function bankLabel(bank: string) { return BANKS.find((b) => b.value === bank)?.label ?? bank }
function bankColor(bank: string, override?: string | null) {
  return override ?? BANKS.find((b) => b.value === bank)?.color ?? '#6b7280'
}

const INPUT_STYLE = { background: '#0f1117', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

export default function SettingsClient() {
  const [tab, setTab] = useState<'accounts' | 'users' | 'merchants'>('accounts')

  // ── Accounts state ──
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accLoading, setAccLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newBank, setNewBank] = useState('TRADE_REPUBLIC')
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [accError, setAccError] = useState('')

  // ── Users state ──
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)
  const [userError, setUserError] = useState('')
  const [changePwId, setChangePwId] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ── Merchants state ──
  const [merchants, setMerchants] = useState<MerchantRow[]>([])
  const [merchantsLoading, setMerchantsLoading] = useState(false)
  const [rules, setRules] = useState<MerchantRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [merchantSearch, setMerchantSearch] = useState('')
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null)
  const [quickCanonical, setQuickCanonical] = useState('')
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [rulePattern, setRulePattern] = useState('')
  const [ruleMatchType, setRuleMatchType] = useState<'contains' | 'startsWith' | 'exact'>('contains')
  const [ruleCanonical, setRuleCanonical] = useState('')
  const [ruleError, setRuleError] = useState('')

  async function loadAccounts() {
    setAccLoading(true)
    const res = await fetch('/api/accounts')
    setAccounts(await res.json())
    setAccLoading(false)
  }

  async function loadUsers() {
    setUsersLoading(true)
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
    setUsersLoading(false)
  }

  async function loadMe() {
    const res = await fetch('/api/auth/me')
    if (res.ok) {
      const d = await res.json()
      setCurrentUserId(d.userId)
      setIsAdmin(d.isAdmin === true)
    }
  }

  async function loadMerchants() {
    setMerchantsLoading(true)
    const res = await fetch('/api/merchants')
    if (res.ok) setMerchants(await res.json())
    setMerchantsLoading(false)
  }

  async function loadRules() {
    setRulesLoading(true)
    const res = await fetch('/api/merchant-rules')
    if (res.ok) setRules(await res.json())
    setRulesLoading(false)
  }

  const [quickRuleError, setQuickRuleError] = useState('')

  async function createQuickRule(raw: string) {
    if (!quickCanonical.trim()) return
    setQuickRuleError('')
    const res = await fetch('/api/merchant-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: raw, matchType: 'exact', canonicalName: quickCanonical.trim(), priority: 10 }),
    })
    if (!res.ok) { const d = await res.json(); setQuickRuleError(d.error ?? 'Error al crear la regla'); return }
    setSelectedMerchant(null)
    setQuickCanonical('')
    loadRules()
    loadMerchants()
  }

  async function createPatternRule() {
    if (!rulePattern.trim() || !ruleCanonical.trim()) { setRuleError('Patrón y nombre canónico requeridos'); return }
    setRuleError('')
    const res = await fetch('/api/merchant-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: rulePattern.trim(), matchType: ruleMatchType, canonicalName: ruleCanonical.trim(), priority: 0 }),
    })
    if (!res.ok) { const d = await res.json(); setRuleError(d.error ?? 'Error al crear la regla'); return }
    setShowRuleForm(false); setRulePattern(''); setRuleCanonical(''); loadRules(); loadMerchants()
  }

  async function deleteRule(id: string) {
    await fetch(`/api/merchant-rules/${id}`, { method: 'DELETE' })
    loadRules()
  }

  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<number | null>(null)

  async function applyRulesToExisting() {
    setApplying(true)
    setApplyResult(null)
    const res = await fetch('/api/merchant-rules/apply', { method: 'POST' })
    if (res.ok) { const d = await res.json(); setApplyResult(d.updated) }
    setApplying(false)
  }

  useEffect(() => { loadAccounts(); loadMe() }, [])
  useEffect(() => { if (tab === 'users') loadUsers() }, [tab])
  useEffect(() => { if (tab === 'merchants') { loadMerchants(); loadRules() } }, [tab])

  // ── Account actions ──
  async function createAccount() {
    if (!newName.trim()) { setAccError('El nombre es obligatorio.'); return }
    setAccError('')
    const color = BANKS.find((b) => b.value === newBank)?.color ?? '#6b7280'
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank: newBank, displayName: newName.trim(), color }),
    })
    if (!res.ok) { const d = await res.json(); setAccError(d.error); return }
    setCreating(false); loadAccounts()
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    await fetch(`/api/accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: editName.trim() }) })
    setEditId(null); loadAccounts()
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`¿Eliminar la cuenta "${name}"?`)) return
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    loadAccounts()
  }

  // ── User actions ──
  async function createUser() {
    if (!newUsername.trim() || !newPassword) { setUserError('Usuario y contraseña requeridos'); return }
    if (newPassword.length < 6) { setUserError('La contraseña debe tener al menos 6 caracteres'); return }
    setUserError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername.trim(), password: newPassword }),
    })
    if (!res.ok) { const d = await res.json(); setUserError(d.error); return }
    setCreatingUser(false); setNewUsername(''); setNewPassword(''); loadUsers()
  }

  async function deleteUser(id: string, username: string) {
    if (!confirm(`¿Eliminar el usuario "${username}"?`)) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    loadUsers()
  }

  async function changePassword(id: string) {
    if (newPw.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return }
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPw }),
    })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    setChangePwId(null); setNewPw('')
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Ajustes</h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {(['accounts', 'users', 'merchants'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            style={{
              background: tab === t ? 'var(--accent)' : 'var(--card)',
              color: tab === t ? '#fff' : 'var(--muted)',
              border: '1px solid var(--card-border)',
            }}>
            {t === 'accounts' ? 'Cuentas bancarias' : t === 'users' ? 'Usuarios' : 'Comercios'}
          </button>
        ))}
      </div>

      {/* ── Accounts ── */}
      {tab === 'accounts' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Define tus cuentas para vincularlas al importar CSVs.
            </p>
            {!creating && (
              <button onClick={() => { setCreating(true); setNewBank('TRADE_REPUBLIC'); setNewName(''); setAccError('') }}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                <Plus size={14} /> Añadir
              </button>
            )}
          </div>

          {creating && (
            <div className="card p-4 mb-3 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={newBank} onChange={(e) => setNewBank(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ ...INPUT_STYLE }}>
                  {BANKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <input type="text" placeholder='Nombre (ej. "Cuenta corriente")' value={newName}
                  onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAccount()}
                  autoFocus className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
              </div>
              {accError && <p className="text-red-400 text-xs">{accError}</p>}
              <div className="flex gap-2">
                <button onClick={createAccount} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
                  <Check size={14} /> Crear
                </button>
                <button onClick={() => setCreating(false)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--card-border)', color: 'var(--muted)' }}>
                  <X size={14} /> Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            {accLoading && <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>}
            {!accLoading && accounts.length === 0 && (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                No hay cuentas. Añade una para vincularla al importar CSVs.
              </div>
            )}
            <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: bankColor(acc.bank, acc.color) }} />
                  {editId === acc.id ? (
                    <>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(acc.id); if (e.key === 'Escape') setEditId(null) }}
                        autoFocus className="flex-1 px-2 py-1 rounded text-sm outline-none" style={INPUT_STYLE} />
                      <button onClick={() => saveEdit(acc.id)} className="p-1 rounded text-green-400 hover:bg-white/10"><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--muted)' }}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" title={acc.displayName}>{acc.displayName}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{bankLabel(acc.bank)}</div>
                      </div>
                      <button onClick={() => { setEditId(acc.id); setEditName(acc.displayName) }}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteAccount(acc.id, acc.displayName)}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div>
          {!isAdmin && !usersLoading && (
            <div className="card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Solo los administradores pueden gestionar usuarios.
            </div>
          )}

          {isAdmin && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Solo los administradores pueden crear usuarios. No hay registro público.
                </p>
                {!creatingUser && (
                  <button onClick={() => { setCreatingUser(true); setNewUsername(''); setNewPassword(''); setUserError('') }}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    <Plus size={14} /> Nuevo usuario
                  </button>
                )}
              </div>

              {creatingUser && (
                <div className="card p-4 mb-3 space-y-3">
                  <h3 className="text-sm font-medium">Nuevo usuario</h3>
                  <input type="text" placeholder="Nombre de usuario" value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoFocus className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
                  <input type="password" placeholder="Contraseña (mín. 6 caracteres)" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createUser()}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
                  {userError && <p className="text-red-400 text-xs">{userError}</p>}
                  <div className="flex gap-2">
                    <button onClick={createUser} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
                      <Check size={14} /> Crear
                    </button>
                    <button onClick={() => setCreatingUser(false)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--card-border)', color: 'var(--muted)' }}>
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="card overflow-hidden">
                {usersLoading && <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>}
                <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {users.map((u) => (
                    <div key={u.id}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate" title={u.username}>{u.username}</span>
                            {u.isAdmin && (
                              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(99,102,241,.15)', color: '#818cf8' }}>
                                <Shield size={10} /> admin
                              </span>
                            )}
                            {u.id === currentUserId && (
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>(tú)</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => { setChangePwId(changePwId === u.id ? null : u.id); setNewPw('') }}
                          className="p-1.5 rounded hover:bg-white/10 transition-colors"
                          style={{ color: 'var(--muted)' }}
                          title="Cambiar contraseña">
                          <KeyRound size={14} />
                        </button>
                        {u.id !== currentUserId && (
                          <button onClick={() => deleteUser(u.id, u.username)}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors text-red-400"
                            title="Eliminar usuario">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {changePwId === u.id && (
                        <div className="px-4 pb-3 flex gap-2" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                          <input type="password" placeholder="Nueva contraseña" value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && changePassword(u.id)}
                            autoFocus className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
                          <button onClick={() => changePassword(u.id)}
                            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg"
                            style={{ background: 'var(--accent)', color: '#fff' }}>
                            <Check size={14} /> Guardar
                          </button>
                          <button onClick={() => { setChangePwId(null); setNewPw('') }}
                            className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--muted)' }}>
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {/* ── Merchants ── */}
      {tab === 'merchants' && (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-[380px_1fr]">
          {/* Rules card */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <span className="text-sm font-medium">Reglas activas</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={applyRulesToExisting}
                  disabled={applying || rules.length === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 transition-opacity"
                  style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
                  title="Aplicar todas las reglas a las transacciones ya importadas">
                  {applying ? 'Aplicando...' : 'Aplicar a existentes'}
                </button>
                {!showRuleForm && (
                  <button onClick={() => { setShowRuleForm(true); setRulePattern(''); setRuleCanonical(''); setRuleError('') }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    <Plus size={12} /> Añadir regla
                  </button>
                )}
              </div>
            </div>
            {applyResult !== null && (
              <div className="px-4 py-2 text-xs" style={{ background: 'rgba(34,197,94,.07)', color: '#22C55E', borderBottom: '1px solid var(--card-border)' }}>
                {applyResult === 0 ? 'Ninguna transacción actualizada (ya están al día).' : `${applyResult} transacciones actualizadas con los nombres canónicos.`}
              </div>
            )}

            {showRuleForm && (
              <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid var(--card-border)' }}>
                <div className="flex gap-2 flex-wrap">
                  <input type="text" placeholder="Patrón (ej. mercadona)" value={rulePattern}
                    onChange={(e) => setRulePattern(e.target.value)}
                    autoFocus className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
                  <select value={ruleMatchType} onChange={(e) => setRuleMatchType(e.target.value as 'contains' | 'startsWith' | 'exact')}
                    className="px-3 py-1.5 rounded-lg text-sm outline-none" style={{ ...INPUT_STYLE, flex: 'none' }}>
                    <option value="contains">contiene</option>
                    <option value="startsWith">empieza por</option>
                    <option value="exact">exacto</option>
                  </select>
                  <input type="text" placeholder="Nombre canónico (ej. Mercadona)" value={ruleCanonical}
                    onChange={(e) => setRuleCanonical(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createPatternRule()}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
                </div>
                {ruleError && <p className="text-red-400 text-xs">{ruleError}</p>}
                <div className="flex gap-2">
                  <button onClick={createPatternRule} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
                    <Check size={14} /> Crear
                  </button>
                  <button onClick={() => setShowRuleForm(false)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--card-border)', color: 'var(--muted)' }}>
                    <X size={14} /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {rulesLoading && <div className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>}
            {!rulesLoading && rules.length === 0 && (
              <div className="py-6 text-center text-xs" style={{ color: 'var(--muted)' }}>
                Sin reglas. Haz clic en el lápiz de un comercio abajo para crear una.
              </div>
            )}
            <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 px-4 py-2.5 min-w-0">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-xs truncate font-mono" style={{ color: 'var(--muted)' }} title={rule.pattern}>{rule.pattern}</div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(99,102,241,.12)', color: '#818cf8' }}>{matchTypeLabel(rule.matchType)}</span>
                      <ArrowRight size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                      <span className="text-sm font-medium truncate" title={rule.canonicalName}>{rule.canonicalName}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteRule(rule.id)} className="p-1 rounded hover:bg-white/10 text-red-400 flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Merchants list card */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <span className="text-sm font-medium">Comercios en base de datos</span>
              <input type="text" placeholder="Buscar..." value={merchantSearch}
                onChange={(e) => setMerchantSearch(e.target.value)}
                className="mt-2 w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
            </div>
            {merchantsLoading && <div className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>}
            <div className="divide-y max-h-96 overflow-y-auto" style={{ borderColor: 'var(--card-border)' }}>
              {merchants
                .filter((m) => !merchantSearch || m.name.toLowerCase().includes(merchantSearch.toLowerCase()))
                .map((m) => (
                  <div key={m.name}>
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{m.name}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.count} transacciones</div>
                      </div>
                      <span className="text-sm font-medium flex-shrink-0">
                        {m.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                      <button
                        onClick={() => {
                          if (selectedMerchant === m.name) { setSelectedMerchant(null); return }
                          setSelectedMerchant(m.name)
                          setQuickCanonical(guessCanonical(m.name))
                        }}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                        style={{ color: selectedMerchant === m.name ? 'var(--accent)' : 'var(--muted)' }}>
                        <Pencil size={13} />
                      </button>
                    </div>
                    {selectedMerchant === m.name && (
                      <div className="px-4 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                        <div className="flex gap-2">
                          <input type="text" value={quickCanonical}
                            onChange={(e) => { setQuickCanonical(e.target.value); setQuickRuleError('') }}
                            onKeyDown={(e) => e.key === 'Enter' && createQuickRule(m.name)}
                            placeholder="Nombre canónico"
                            autoFocus className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
                          <button onClick={() => createQuickRule(m.name)}
                            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg flex-shrink-0"
                            style={{ background: 'var(--accent)', color: '#fff' }}>
                            <Check size={14} /> Crear regla exacta
                          </button>
                          <button onClick={() => { setSelectedMerchant(null); setQuickRuleError('') }}
                            className="p-1.5 rounded hover:bg-white/10 flex-shrink-0" style={{ color: 'var(--muted)' }}>
                            <X size={14} />
                          </button>
                        </div>
                        {quickRuleError && <p className="text-red-400 text-xs">{quickRuleError}</p>}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
