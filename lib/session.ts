import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  userId?: string
  username?: string
  isAdmin?: boolean
  isLoggedIn: boolean
  trProcessId?: string
}

export const sessionOptions: SessionOptions = {
  cookieName: 'gastoh_session',
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session
}
