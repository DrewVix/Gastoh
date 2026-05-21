import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIES = [
  { name: 'Supermercado', icon: '🛒', color: '#4CAF50', keywords: ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'eroski', 'alcampo', 'consum'] },
  { name: 'Restaurantes', icon: '🍽️', color: '#FF9800', keywords: ['restaurante', 'bar', 'cafeteria', 'mcdonald', 'pizza', 'burger', 'sushi', 'kebab'] },
  { name: 'Delivery', icon: '🛵', color: '#FF5722', keywords: ['glovo', 'uber eats', 'just eat', 'deliveroo'] },
  { name: 'Transporte', icon: '🚌', color: '#2196F3', keywords: ['renfe', 'metro', 'emt', 'taxi', 'uber', 'cabify', 'bolt', 'blablacar'] },
  { name: 'Gasolina', icon: '⛽', color: '#795548', keywords: ['repsol', 'bp', 'cepsa', 'galp', 'gasolinera'] },
  { name: 'Compras Online', icon: '📦', color: '#9C27B0', keywords: ['amazon', 'el corte ingles', 'fnac', 'mediamarkt', 'pccomponentes', 'aliexpress'] },
  { name: 'Ropa', icon: '👕', color: '#E91E63', keywords: ['zara', 'mango', 'h&m', 'primark', 'pull bear', 'bershka', 'stradivarius', 'shein'] },
  { name: 'Suscripciones', icon: '📱', color: '#00BCD4', keywords: ['spotify', 'netflix', 'disney', 'hbo', 'amazon prime', 'youtube premium', 'apple'] },
  { name: 'Salud', icon: '💊', color: '#F44336', keywords: ['farmacia', 'clinica', 'medico', 'dentista', 'optica', 'sanitas', 'adeslas'] },
  { name: 'Deporte', icon: '🏃', color: '#8BC34A', keywords: ['gym', 'gimnasio', 'fitness', 'padel', 'decathlon'] },
  { name: 'Vivienda', icon: '🏠', color: '#607D8B', keywords: ['alquiler', 'hipoteca', 'comunidad', 'ibi'] },
  { name: 'Utilities', icon: '💡', color: '#FFC107', keywords: ['endesa', 'iberdrola', 'naturgy', 'gas natural'] },
  { name: 'Telecomunicaciones', icon: '📡', color: '#3F51B5', keywords: ['vodafone', 'movistar', 'orange', 'yoigo', 'masmovil'] },
  { name: 'Seguros', icon: '🛡️', color: '#009688', keywords: ['seguro', 'axa', 'mapfre', 'mutua'] },
  { name: 'Transferencias', icon: '💸', color: '#FF6F00', keywords: ['bizum', 'paypal', 'transferencia'] },
  { name: 'Efectivo', icon: '💵', color: '#78909C', keywords: ['cajero', 'atm', 'reintegro'] },
  { name: 'Ingreso', icon: '✅', color: '#43A047', keywords: ['nomina', 'salario', 'sueldo'] },
  { name: 'Hogar', icon: '🛋️', color: '#A1887F', keywords: ['ikea', 'leroy merlin', 'bricomart'] },
  { name: 'Otro', icon: '❓', color: '#9E9E9E', keywords: [] },
]

async function main() {
  console.log('Seeding categories...')
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
        rules: {
          create: cat.keywords.map((kw, i) => ({
            pattern: kw,
            isRegex: false,
            priority: cat.keywords.length - i,
          })),
        },
      },
    })
    console.log(`  ✓ ${cat.name}`)
  }
  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
