import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const rules = await prisma.merchantRule.findMany({
    where: { userId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { pattern, matchType, canonicalName, priority } = await req.json()
  if (!pattern?.trim()) return NextResponse.json({ error: 'Patrón requerido' }, { status: 400 })
  if (!canonicalName?.trim()) return NextResponse.json({ error: 'Nombre canónico requerido' }, { status: 400 })

  const validMatchTypes = ['contains', 'startsWith', 'exact']
  const resolvedMatchType = validMatchTypes.includes(matchType) ? matchType : 'contains'

  // Block duplicate patterns (SQLite has no case-insensitive mode, compare in JS)
  const allRules = await prisma.merchantRule.findMany({ where: { userId, matchType: resolvedMatchType }, select: { pattern: true } })
  const patternLower = pattern.trim().toLowerCase()
  if (allRules.some((r) => r.pattern.toLowerCase() === patternLower)) {
    return NextResponse.json(
      { error: `Ya existe una regla con el patrón "${pattern.trim()}" y tipo "${resolvedMatchType}"` },
      { status: 409 },
    )
  }

  const rule = await prisma.merchantRule.create({
    data: {
      userId,
      pattern: pattern.trim(),
      matchType: resolvedMatchType,
      canonicalName: canonicalName.trim(),
      priority: typeof priority === 'number' ? priority : 0,
    },
  })
  return NextResponse.json(rule, { status: 201 })
}
