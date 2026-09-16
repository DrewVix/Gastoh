import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Gastoh — Seguimiento de gastos',
  description: 'Registra y categoriza tus gastos e ingresos a mano',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gastoh',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full antialiased ${spaceGrotesk.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
