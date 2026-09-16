import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="font-display text-5xl font-semibold mb-2" style={{ color: 'var(--accent)' }}>404</div>
        <h1 className="text-lg font-semibold mb-1">Página no encontrada</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Esta dirección no existe o se ha movido.
        </p>
        <Link
          href="/dashboard"
          className="inline-block w-full py-2 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Volver al dashboard
        </Link>
      </div>
    </div>
  )
}
