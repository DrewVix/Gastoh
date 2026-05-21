import { prisma } from './db'

// MCC (Merchant Category Code) → category name
const MCC_CATEGORIES: Record<string, string> = {
  // Supermercado
  '5411': 'Supermercado', '5412': 'Supermercado', '5422': 'Supermercado',
  '5441': 'Supermercado', '5451': 'Supermercado', '5462': 'Supermercado', '5499': 'Supermercado',
  // Restaurantes
  '5812': 'Restaurantes', '5813': 'Restaurantes', '5814': 'Restaurantes',
  // Gasolina
  '5541': 'Gasolina', '5542': 'Gasolina', '5983': 'Gasolina',
  // Transporte
  '4111': 'Transporte', '4112': 'Transporte', '4121': 'Transporte',
  '4131': 'Transporte', '4215': 'Transporte', '4411': 'Transporte',
  '4511': 'Transporte', '4722': 'Transporte', '7011': 'Transporte',
  '7512': 'Transporte', '7513': 'Transporte', '7514': 'Transporte',
  // Salud
  '5047': 'Salud', '5122': 'Salud', '5912': 'Salud',
  '8011': 'Salud', '8021': 'Salud', '8049': 'Salud', '8062': 'Salud', '8099': 'Salud',
  // Ropa
  '5621': 'Ropa', '5631': 'Ropa', '5651': 'Ropa',
  '5661': 'Ropa', '5691': 'Ropa', '5699': 'Ropa',
  // Compras Online / Retail
  '5045': 'Compras Online', '5065': 'Compras Online',
  '5311': 'Compras Online', '5331': 'Compras Online',
  '5399': 'Compras Online', '5999': 'Compras Online',
  '5732': 'Compras Online', '5734': 'Compras Online',
  // Deporte
  '5655': 'Deporte', '5940': 'Deporte', '5941': 'Deporte',
  '7941': 'Deporte', '7991': 'Deporte', '7997': 'Deporte',
  // Telecomunicaciones
  '4812': 'Telecomunicaciones', '4813': 'Telecomunicaciones', '4814': 'Telecomunicaciones',
  // Suscripciones
  '4899': 'Suscripciones', '7372': 'Suscripciones', '7379': 'Suscripciones',
  // Utilities
  '4900': 'Utilities',
  // Seguros
  '6300': 'Seguros', '6321': 'Seguros', '6399': 'Seguros',
  // Hogar
  '5200': 'Hogar', '5211': 'Hogar', '5251': 'Hogar', '5261': 'Hogar',
  '5712': 'Hogar', '5713': 'Hogar', '5714': 'Hogar', '5719': 'Hogar', '5722': 'Hogar',
  // Efectivo
  '6010': 'Efectivo', '6011': 'Efectivo',
  // Otro (entertainment, education, misc)
  '7832': 'Otro', '7922': 'Otro', '7929': 'Otro',
  '7933': 'Otro', '7993': 'Otro', '7994': 'Otro', '7996': 'Otro', '7999': 'Otro',
  '8211': 'Otro', '8220': 'Otro', '8249': 'Otro', '8299': 'Otro',
}

// Trade Republic transaction type → category name
const TR_TYPE_CATEGORIES: Record<string, string> = {
  'INTEREST_PAYMENT': 'Ingreso',
  'INTEREST_PAYOUT': 'Ingreso',
  'DIVIDEND_PAYMENT': 'Ingreso',
  'CUSTOMER_INBOUND': 'Ingreso',
  'TRANSFER_INSTANT_INBOUND': 'Transferencias',
  'TRANSFER_INBOUND': 'Transferencias',
  'CUSTOMER_OUTBOUND_REQUEST': 'Transferencias',
  'TRANSFER_OUTBOUND': 'Transferencias',
  'ORDER_BUY': 'Inversión',
  'ORDER_SELL': 'Inversión',
  'SAVINGS_PLAN_EXECUTE': 'Inversión',
  'CARD_TRANSACTION': null as unknown as string,  // se categoriza por MCC/descripción
}

const BUILTIN_KEYWORDS: Array<[RegExp, string]> = [
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
  [/nomina|salario|sueldo|interest.?payment/, 'Ingreso'],
  [/seguro|axa|mapfre|mutua.?madrilena/, 'Seguros'],
  [/ikea|leroy.?merlin|bricomart|brico.?depot/, 'Hogar'],
]

async function findByName(name: string): Promise<string | null> {
  const cat = await prisma.category.findFirst({ where: { name } })
  return cat?.id ?? null
}

export async function categorize(
  description: string,
  opts?: { mccCode?: string; trType?: string }
): Promise<string | null> {
  const normalized = description.toLowerCase().trim()

  // 1. Custom DB rules (highest priority)
  const rules = await prisma.categoryRule.findMany({
    include: { category: true },
    orderBy: { priority: 'desc' },
  })
  for (const rule of rules) {
    const matches = rule.isRegex
      ? new RegExp(rule.pattern, 'i').test(normalized)
      : normalized.includes(rule.pattern.toLowerCase())
    if (matches) return rule.categoryId
  }

  // 2. MCC code (authoritative merchant category from card network)
  if (opts?.mccCode && opts.mccCode.trim()) {
    const catName = MCC_CATEGORIES[opts.mccCode.trim()]
    if (catName) {
      const id = await findByName(catName)
      if (id) return id
    }
  }

  // 3. Trade Republic transaction type
  if (opts?.trType && opts.trType.trim()) {
    const catName = TR_TYPE_CATEGORIES[opts.trType.trim()]
    if (catName) {  // null = seguir con keyword matching (ej. CARD_TRANSACTION)
      const id = await findByName(catName)
      if (id) return id
    }
  }

  // 4. Keyword matching on description
  for (const [regex, categoryName] of BUILTIN_KEYWORDS) {
    if (regex.test(normalized)) {
      const id = await findByName(categoryName)
      if (id) return id
    }
  }

  return await findByName('Otro')
}
