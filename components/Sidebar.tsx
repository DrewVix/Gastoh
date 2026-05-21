'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, List, CalendarDays, Tag, Upload, Settings, LogOut } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Gastos', icon: List },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/categories', label: 'Categorías', icon: Tag },
  { href: '/import', label: 'Importar', icon: Upload },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d) setUsername(d.username) })
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const initials = username ? username.slice(0, 2).toUpperCase() : '?'

  return (
    <aside
      className="w-64 flex flex-col shrink-0"
      style={{ background: 'var(--card)', borderRight: '1px solid var(--card-border)' }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="text-xl font-bold tracking-tight">Gastoh</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Control de gastos</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? 'rgba(99,102,241,.15)' : 'transparent',
                color: active ? '#818cf8' : 'var(--muted)',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {initials}
          </div>
          <span className="text-sm flex-1 truncate" style={{ color: 'var(--foreground)' }}>
            {username ?? '…'}
          </span>
          <button
            onClick={handleLogout}
            className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
            style={{ color: 'var(--muted)' }}
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
