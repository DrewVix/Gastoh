import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { id } = await params
  const { displayName, color } = await req.json()

  const account = await prisma.bankAccount.update({
    where: { id, userId },
    data: {
      ...(displayName?.trim() && { displayName: displayName.trim() }),
      ...(color !== undefined && { color }),
    },
  })
  return NextResponse.json(account)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { id } = await params

  const count = await prisma.transaction.count({ where: { bankAccountId: id, userId } })
  if (count > 0) {
    return NextResponse.json(
      { error: `Esta cuenta tiene ${count} transacciones vinculadas. Elimínalas primero.` },
      { status: 409 }
    )
  }

  await prisma.bankAccount.delete({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
