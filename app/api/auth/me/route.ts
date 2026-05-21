import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    userId: session.userId,
    username: session.username,
    isAdmin: session.isAdmin ?? false,
  })
}
