'use strict'
// Recategoriza transacciones sin categoría usando las reglas existentes
// También añade la merchant rule para "Interest payment for payout collection"

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

// Mapa de keywords → nombre de categoría (mismo que categorizer.ts)
const KEYWORDS = [
  [/mercadona|carrefour|lidl|aldi|dia\b|eroski|hipercor|alcampo|consum|el.?arbol/, 'Supermercado'],
  [/glovo|uber.?eats|just.?eat|deliveroo/, 'Delivery'],
  [/restaurante|restaurant|cafeter|bar\b|cafe\b|pizza|burger|mcdonald|kfc|subway|sushi/, 'Restaurantes'],
  [/renfe|metro\b|emt\b|tram\b|cabify|uber\b|bolt\b|taxi|blablacar|cercanias/, 'Transporte'],
  [/repsol|bp\b|cepsa|galp|gasolinera|carburante/, 'Gasolina'],
  [/amazon|el.?corte.?ingles|fnac|mediamarkt|pccomponentes|aliexpress/, 'Compras Online'],
  [/spotify|netflix|disney|hbo|prime.?video|youtube.?premium|apple.?tv/, 'Suscripciones'],
  [/farmacia|pharmacy|clinica|medico|dentista|optica|sanitas|adeslas/, 'Salud'],
  [/gym|gimnasio|fitness|padel|deporte|decathlon/, 'Deporte'],
  [/zara|mango|h&m|primark|pull.?bear|bershka|stradivarius|shein/, 'Ropa'],
  [/vodafone|movistar|orange\b|yoigo|masmovil|jazztel/, 'Telecomunicaciones'],
  [/endesa|iberdrola|naturgy|gas.?natural|ibergas/, 'Utilities'],
  [/alquiler|hipoteca|comunidad|ibi\b/, 'Vivienda'],
  [/paypal|bizum/, 'Transferencias'],
  [/atm\b|cajero|reintegro/, 'Efectivo'],
  [/nomina|salario|sueldo|interest.?payout|interest.?payment|dividend/, 'Ingreso'],
  [/seguro|axa|mapfre|mutua.?madrilena/, 'Seguros'],
  [/ikea|leroy.?merlin|bricomart|brico.?depot/, 'Hogar'],
  [/trade.?republic|etf|saving.?plan/, 'Inversion'],
  [/ES\d{20,}/, 'Transferencias'],  // IBANs
]

const TR_TYPES = {
  INTEREST_PAYMENT: 'Ingreso', INTEREST_PAYOUT: 'Ingreso',
  DIVIDEND_PAYMENT: 'Ingreso', CUSTOMER_INBOUND: 'Ingreso',
  TRANSFER_INSTANT_INBOUND: 'Transferencias', TRANSFER_INBOUND: 'Transferencias',
  CUSTOMER_OUTBOUND_REQUEST: 'Transferencias', TRANSFER_OUTBOUND: 'Transferencias',
  ORDER_BUY: 'Inversion', ORDER_SELL: 'Inversion', SAVINGS_PLAN_EXECUTE: 'Inversion',
}

async function main() {
  // 1. Merchant rule para "Interest payment for payout collection"
  const existing = await p.merchantRule.findFirst({
    where: { pattern: { contains: 'interest payment for payout' } }
  })
  if (!existing) {
    await p.merchantRule.create({
      data: { pattern: 'interest payment for payout', matchType: 'contains', canonicalName: 'Pago intereses', priority: 20 }
    })
    console.log('+ Regla de comercio: "Pago intereses" creada')
  }

  // 2. Cargar categorías y reglas DB
  const categories = await p.category.findMany({ select: { id: true, name: true } })
  const catByName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
  const dbRules = await p.categoryRule.findMany({
    include: { category: true }, orderBy: { priority: 'desc' }
  })

  function findCat(name) {
    return catByName.get(name.toLowerCase()) ?? null
  }

  function categorize(description, trType) {
    const norm = description.toLowerCase().trim()

    // 1. Reglas DB
    for (const rule of dbRules) {
      const match = rule.isRegex
        ? new RegExp(rule.pattern, 'i').test(norm)
        : norm.includes(rule.pattern.toLowerCase())
      if (match) return rule.categoryId
    }

    // 2. Tipo TR
    if (trType && TR_TYPES[trType]) return findCat(TR_TYPES[trType])

    // 3. Keywords
    for (const [regex, catName] of KEYWORDS) {
      if (regex.test(norm)) return findCat(catName)
    }

    return findCat('Otro')
  }

  // 3. Recategorizar transacciones sin categoría
  const uncategorized = await p.transaction.findMany({
    where: { categoryId: null },
    select: { id: true, description: true, merchantName: true }
  })

  console.log(`\nRecategorizando ${uncategorized.length} transacciones sin categoría...`)
  let updated = 0
  for (const tx of uncategorized) {
    const desc = tx.merchantName || tx.description
    const categoryId = categorize(desc, null)
    if (categoryId) {
      await p.transaction.update({ where: { id: tx.id }, data: { categoryId } })
      updated++
    }
  }
  console.log(`✓ ${updated} transacciones categorizadas`)

  // 4. También recategorizar las que tienen categoryId pero con tipo TR conocido
  // (por si se importaron antes de que existieran las reglas de tipo)
  console.log('\nListo.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
