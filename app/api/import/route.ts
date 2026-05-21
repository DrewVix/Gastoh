import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { categorize } from '@/lib/categorizer'
import { applyRules } from '@/lib/merchant-rules'

interface ImportTx {
  date: string
  description: string
  amount: number
  externalId?: string   // e.g. Trade Republic transaction_id
  mccCode?: string      // Merchant Category Code from card network
  trType?: string       // Trade Republic transaction type
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

    const merchantRules = await prisma.merchantRule.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })

    let imported = 0
    let skipped = 0

    for (const tx of transactions) {
      const { date, description, amount, mccCode, trType } = tx
      if (!date || !description || amount == null || isNaN(amount)) continue

      // Use bank-provided ID when available (more reliable than hash)
      const externalId = tx.externalId
        ? `ext_${tx.externalId}`
        : 'import_' + createHash('sha256').update(`${date}|${description}|${amount}`).digest('hex').substring(0, 32)

      const exists = await prisma.transaction.findFirst({ where: { externalId, userId } })
      if (exists) { skipped++; continue }

      const categoryId = await categorize(description, { mccCode, trType })
      const merchantName = applyRules(description, merchantRules)

      try {
        await prisma.transaction.create({
          data: {
            userId,
            externalId,
            bankAccountId: accountId ?? null,
            date: new Date(date),
            amount,
            description,
            merchantName: merchantName !== description ? merchantName : null,
            categoryId,
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
