import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const accounts = await prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { bank, displayName, color } = await req.json()
  if (!bank || !displayName?.trim()) {
    return NextResponse.json({ error: 'bank and displayName are required' }, { status: 400 })
  }

  const account = await prisma.bankAccount.create({
    data: { userId, bank, displayName: displayName.trim(), color: color ?? null },
  })
  return NextResponse.json(account)
}
