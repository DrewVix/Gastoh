'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, X, Shield, KeyRound } from 'lucide-react'
import Skeleton from './Skeleton'

interface User {
  id: string; username: string; isAdmin: boolean; createdAt: string
}

const INPUT_STYLE = { background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

export default function SettingsClient() {
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
  const [pwError, setPwError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  // ── Own account (self-service password change) ──
  const [myUsername, setMyUsername] = useState('')
  const [myNewPw, setMyNewPw] = useState('')
  const [myPwError, setMyPwError] = useState('')
  const [myPwSuccess, setMyPwSuccess] = useState(false)
  const [myPwSaving, setMyPwSaving] = useState(false)

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
      setMyUsername(d.username)
      setIsAdmin(d.isAdmin === true)
      if (d.isAdmin === true) loadUsers()
    }
  }

  useEffect(() => { loadMe() }, [])

  async function changeMyPassword() {
    if (myNewPw.length < 6) { setMyPwError('La contraseña debe tener al menos 6 caracteres'); return }
    setMyPwError('')
    setMyPwSaving(true)
    const res = await fetch(`/api/users/${currentUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: myNewPw }),
    })
    setMyPwSaving(false)
    if (!res.ok) { const d = await res.json(); setMyPwError(d.error); return }
    setMyNewPw('')
    setMyPwSuccess(true)
    setTimeout(() => setMyPwSuccess(false), 3000)
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
    setActionError('')
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setActionError(d.error); return }
    loadUsers()
  }

  async function changePassword(id: string) {
    if (newPw.length < 6) { setPwError('La contraseña debe tener al menos 6 caracteres'); return }
    setPwError('')
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPw }),
    })
    if (!res.ok) { const d = await res.json(); setPwError(d.error); return }
    setChangePwId(null); setNewPw('')
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Ajustes</h1>

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Mi cuenta</h3>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Sesión iniciada como <strong style={{ color: 'var(--foreground)' }}>{myUsername || '…'}</strong>
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input type="password" placeholder="Nueva contraseña" value={myNewPw}
            onChange={(e) => { setMyNewPw(e.target.value); setMyPwError(''); setMyPwSuccess(false) }}
            onKeyDown={(e) => e.key === 'Enter' && changeMyPassword()}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
          <button onClick={changeMyPassword} disabled={myPwSaving}
            className="flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <KeyRound size={14} /> {myPwSaving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </div>
        {myPwError && <p className="text-xs" style={{ color: 'var(--negative)' }}>{myPwError}</p>}
        {myPwSuccess && <p className="text-xs" style={{ color: 'var(--positive)' }}>Contraseña actualizada.</p>}
      </div>

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

          {actionError && (
            <div className="flex items-center justify-between gap-3 text-sm px-4 py-2.5 rounded-lg mb-3"
              style={{ background: 'var(--negative-soft)', color: 'var(--negative)' }}>
              <span>{actionError}</span>
              <button onClick={() => setActionError('')} className="flex-shrink-0"><X size={14} /></button>
            </div>
          )}

          <div className="card overflow-hidden">
            {usersLoading && (
              <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-4 flex-1 max-w-40" />
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                ))}
              </div>
            )}
            <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {users.map((u) => (
                <div key={u.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate" title={u.username}>{u.username}</span>
                        {u.isAdmin && (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(0,217,118,.15)', color: 'var(--accent)' }}>
                            <Shield size={10} /> admin
                          </span>
                        )}
                        {u.id === currentUserId && (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>(tú)</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setChangePwId(changePwId === u.id ? null : u.id); setNewPw(''); setPwError('') }}
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
                    <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                      <div className="flex gap-2">
                        <input type="password" placeholder="Nueva contraseña" value={newPw}
                          onChange={(e) => { setNewPw(e.target.value); setPwError('') }}
                          onKeyDown={(e) => e.key === 'Enter' && changePassword(u.id)}
                          autoFocus className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
                        <button onClick={() => changePassword(u.id)}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                          <Check size={14} /> Guardar
                        </button>
                        <button onClick={() => { setChangePwId(null); setNewPw(''); setPwError('') }}
                          className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--muted)' }}>
                          <X size={14} />
                        </button>
                      </div>
                      {pwError && <p className="text-xs mt-1.5" style={{ color: 'var(--negative)' }}>{pwError}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
