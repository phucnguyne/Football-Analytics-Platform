import { PrismaClient } from '@prisma/client'
import { env } from '@app/config'

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: { url: env.DATABASE_URL },
    },
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
