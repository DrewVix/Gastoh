import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { sessionOptions, SessionData } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.userId = user.id
  session.username = user.username
  session.isAdmin = user.isAdmin
  session.isLoggedIn = true
  await session.save()

  return NextResponse.json({ ok: true })
}
