import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { id } = await params
  const body = await req.json()
  const { categoryId, notes, isTransfer, merchantName } = body

  const updated = await prisma.transaction.update({
    where: { id, userId },
    data: {
      ...(categoryId !== undefined && { categoryId, isManual: true }),
      ...(notes !== undefined && { notes }),
      ...(isTransfer !== undefined && { isTransfer }),
      ...(merchantName !== undefined && { merchantName: merchantName || null }),
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  })

  return NextResponse.json(updated)
}
