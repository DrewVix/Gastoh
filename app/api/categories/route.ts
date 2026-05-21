import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const all = await prisma.category.findMany({
    where: { userId },
    include: {
      parent: { select: { id: true, name: true, color: true, icon: true } },
      children: {
        select: { id: true, name: true, icon: true, color: true, isDefault: true, parentId: true,
          _count: { select: { transactions: true, rules: true } } },
        orderBy: { name: 'asc' },
      },
      _count: { select: { transactions: true, rules: true } },
    },
    orderBy: { name: 'asc' },
  })

  // Grupos: categorías sin parentId que tienen hijos
  const groups = all.filter(c => c.parentId === null && c.children.length > 0)
  // Sin grupo: categorías raíz sin hijos (ej. "Otro")
  const ungrouped = all.filter(c => c.parentId === null && c.children.length === 0)
  // Flat: todas, para selectores
  const flat = all

  return NextResponse.json({ groups, ungrouped, flat })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const { name, icon, color, parentId } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const category = await prisma.category.create({
    data: { userId, name, icon, color, parentId: parentId ?? null },
    include: { parent: { select: { id: true, name: true, color: true, icon: true } } },
  })

  return NextResponse.json(category, { status: 201 })
}
