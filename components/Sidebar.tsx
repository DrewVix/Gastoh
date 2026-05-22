'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, List, CalendarDays, Tag, Upload, Settings, LogOut, FileBarChart2 } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Gastos', icon: List },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/categories', label: 'Categorías', icon: Tag },
  { href: '/report', label: 'Informe', icon: FileBarChart2 },
  { href: '/import', label: 'Importar', icon: Upload },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]

// Bottom nav only shows the most important 5 items on mobile
const bottomNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transacciones', icon: List },
  { href: '/categories', label: 'Categorías', icon: Tag },
  { href: '/report', label: 'Informe', icon: FileBarChart2 },
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
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside
        className="hidden md:flex w-64 flex-col shrink-0"
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

      {/* ── Mobile bottom navigation bar (below md) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--card-border)',
          height: '60px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {bottomNav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
              style={{ color: active ? '#818cf8' : 'var(--muted)' }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
