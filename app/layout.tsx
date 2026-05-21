import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gastoh — Seguimiento de gastos',
  description: 'Registra y categoriza tus gastos de TradeRepublic y OpenBank',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
