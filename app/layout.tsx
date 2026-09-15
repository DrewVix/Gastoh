import type { Metadata } from 'next'
import { Fraunces } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Gastoh — Seguimiento de gastos',
  description: 'Registra y categoriza tus gastos de TradeRepublic y OpenBank',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full antialiased ${fraunces.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
