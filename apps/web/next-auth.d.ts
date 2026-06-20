import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      //role?: string // nếu bạn có thêm field role từ Prisma User
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string
    //role?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    //role?: string
  }
}