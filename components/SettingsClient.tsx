'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Shield, KeyRound } from 'lucide-react'

interface Account {
  id: string; bank: string; displayName: string; color: string | null; createdAt: string
}

interface User {
  id: string; username: string; isAdmin: boolean; createdAt: string
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
  const [tab, setTab] = useState<'accounts' | 'users'>('accounts')

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

  useEffect(() => { loadAccounts(); loadMe() }, [])
  useEffect(() => { if (tab === 'users') loadUsers() }, [tab])

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
        {(['accounts', 'users'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            style={{
              background: tab === t ? 'var(--accent)' : 'var(--card)',
              color: tab === t ? '#fff' : 'var(--muted)',
              border: '1px solid var(--card-border)',
            }}>
            {t === 'accounts' ? 'Cuentas bancarias' : 'Usuarios'}
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
    </div>
  )
}
