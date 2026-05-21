import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { applyRules } from '@/lib/merchant-rules'

export async function POST() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const rules = await prisma.merchantRule.findMany({
    where: { userId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })
  if (!rules.length) return NextResponse.json({ updated: 0 })

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: { id: true, description: true, merchantName: true },
  })

  let updated = 0
  for (const tx of transactions) {
    const canonical = applyRules(tx.description, rules)
    // Solo actualizar si la regla produjo un nombre diferente al description (hubo match)
    // y es distinto al merchantName actual
    if (canonical !== tx.description && canonical !== tx.merchantName) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { merchantName: canonical },
      })
      updated++
    }
  }

  return NextResponse.json({ updated })
}
