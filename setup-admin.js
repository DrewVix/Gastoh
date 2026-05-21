'use strict'
// Crea o actualiza el usuario admin con una contraseña en texto plano.
// Uso: node setup-admin.js <username> <password>

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { seedCategoriesForUser } = require('./prisma/default-categories')

const [,, username, password] = process.argv
if (!username || !password) {
  console.error('Uso: node setup-admin.js <username> <password>')
  process.exit(1)
}

const p = new PrismaClient()

async function run() {
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await p.user.upsert({
    where: { username },
    update: { passwordHash, isAdmin: true },
    create: { username, passwordHash, isAdmin: true },
  })
  console.log(`✓ Usuario '${user.username}' listo (admin)`)
  await seedCategoriesForUser(p, user.id)
}

run()
  .catch(e => { console.error('Error:', e.message); process.exit(1) })
  .finally(() => p.$disconnect())
