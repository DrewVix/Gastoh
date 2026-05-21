'use strict'

const { PrismaClient } = require('@prisma/client')
const { seedCategoriesForUser } = require('./default-categories')

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } })
  if (users.length === 0) {
    console.log('→ Sin usuarios todavía, se omite el seed de categorías.')
    return
  }
  for (const user of users) {
    await seedCategoriesForUser(prisma, user.id)
  }
  console.log('→ Seed completado.')
}

main()
  .catch(err => { console.error('Seed error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
