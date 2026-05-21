import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const [txs, rules] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, amount: { lt: 0 }, isTransfer: false },
      select: { merchantName: true, description: true, amount: true },
    }),
    prisma.merchantRule.findMany({ where: { userId }, select: { canonicalName: true } }),
  ])

  const map = new Map<string, { count: number; total: number }>()

  for (const tx of txs) {
    const key = (tx.merchantName || tx.description).trim()
    if (!key) continue
    const normalized = key.toLowerCase()
    // find existing entry case-insensitively
    let found: string | undefined
    for (const k of map.keys()) { if (k.toLowerCase() === normalized) { found = k; break } }
    const cur = map.get(found ?? key)
    if (cur) { cur.count++; cur.total += Math.abs(tx.amount) }
    else map.set(found ?? key, { count: 1, total: Math.abs(tx.amount) })
  }

  // Add canonical names from rules that aren't already in the map
  for (const rule of rules) {
    const name = rule.canonicalName.trim()
    if (!name) continue
    const normalized = name.toLowerCase()
    let exists = false
    for (const k of map.keys()) { if (k.toLowerCase() === normalized) { exists = true; break } }
    if (!exists) map.set(name, { count: 0, total: 0 })
  }

  const result = Array.from(map.entries())
    .map(([name, { count, total }]) => ({ name, count, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json(result)
}
