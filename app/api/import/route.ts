import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'

interface ImportTx {
  date: string
  description: string
  amount: number
  externalId?: string   // e.g. Trade Republic transaction_id
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId!
    const { transactions, accountId } = (await req.json()) as { transactions: ImportTx[]; accountId?: string }
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    let imported = 0
    let skipped = 0

    for (const tx of transactions) {
      const { date, description, amount } = tx
      if (!date || !description || amount == null || isNaN(amount)) continue

      // Use bank-provided ID when available (more reliable than hash)
      const externalId = tx.externalId
        ? `ext_${tx.externalId}`
        : 'import_' + createHash('sha256').update(`${date}|${description}|${amount}`).digest('hex').substring(0, 32)

      const exists = await prisma.transaction.findFirst({ where: { externalId, userId } })
      if (exists) { skipped++; continue }

      try {
        await prisma.transaction.create({
          data: {
            userId,
            externalId,
            bankAccountId: accountId ?? null,
            date: new Date(date),
            amount,
            description,
            categoryId: null,
            isManual: true,
          },
        })
        imported++
      } catch {
        skipped++
      }
    }

    return NextResponse.json({ imported, skipped })
  } catch (err: any) {
    console.error('[/api/import]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
