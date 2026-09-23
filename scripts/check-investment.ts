// npx tsx scripts/check-investment.ts
import assert from 'node:assert/strict'
import { isInvestmentName, splitInvestment } from '../lib/investment'

assert.ok(isInvestmentName('Inversión') && isInvestmentName(' inversion ') && isInvestmentName('INVERSION'))
assert.ok(!isInvestmentName('Inversiones') && !isInvestmentName('Alimentación'))

const cat = (name: string) => ({ name, color: '#000' })
const invIds = new Set(['inv', 'msci'])
const { txs, investment } = splitInvestment([
  { amount: 3000, categoryId: 'nomina', category: cat('Ingreso') },
  { amount: -200, categoryId: 'super', category: cat('Supermercado') },
  { amount: -50, categoryId: null, category: null },                 // sin categoría: se mantiene
  { amount: -300, categoryId: 'msci', category: cat('MSCI World') }, // compra
  { amount: -1050, categoryId: 'inv', category: cat('Inversión') },   // compra
  { amount: 1000, categoryId: 'inv', category: cat('Inversión') },    // venta
], invIds)

assert.equal(txs.length, 3)
assert.deepEqual(txs.map((t) => t.categoryId), ['nomina', 'super', null])
assert.equal(investment.buys, 1350)
assert.equal(investment.sales, 1000)
assert.equal(investment.total, 350)
assert.deepEqual(investment.breakdown.map((b) => [b.id, b.total]), [['msci', 300], ['inv', 50]])

// Liquidez: ingresos 3000 − gastos 250 − invertido neto 350 = 2400 (la venta no cuenta dos veces)
const income = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
const expenses = txs.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)
assert.equal(income - expenses - investment.total, 2400)

console.log('ok')
