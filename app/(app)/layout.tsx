export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.isLoggedIn) redirect('/login')

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6 pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:pb-6 max-w-[1440px] mx-auto">
        {children}
      </main>
    </div>
  )
}
