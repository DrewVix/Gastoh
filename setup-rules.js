'use strict'
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

// Example setup script — replace patterns with your own values before running
async function run() {
  await p.merchantRule.create({
    data: { pattern: 'interest payment for payout', matchType: 'contains', canonicalName: 'Pago intereses', priority: 20 }
  }).catch(() => console.log('  (intereses ya existia)'))
  console.log('+ Pago intereses')

  console.log('Listo.')
  await p.$disconnect()
}

run().catch(async e => { console.error(e.message); await p.$disconnect() })
