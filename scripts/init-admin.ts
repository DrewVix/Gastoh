import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = process.argv[2]
  const username = process.argv[3] ?? 'admin'

  if (!password) {
    console.error('Usage: npx tsx scripts/init-admin.ts <password> [username]')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash, isAdmin: true },
  })

  console.log(`✓ Usuario "${user.username}" listo (admin: ${user.isAdmin})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
