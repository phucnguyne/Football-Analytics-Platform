import type { DefaultSession } from 'next-auth'

type AccountRole = 'USER' | 'ADMIN'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: AccountRole
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sid?: string
    role?: AccountRole
    absoluteExpires?: number
  }
}
