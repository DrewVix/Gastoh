import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    select: { id: true, username: true, isAdmin: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { username, password } = await req.json()
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (exists) {
    return NextResponse.json({ error: 'Ese nombre de usuario ya existe' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { username: username.trim(), passwordHash, isAdmin: false },
    select: { id: true, username: true, isAdmin: true, createdAt: true },
  })

  return NextResponse.json(user, { status: 201 })
}
