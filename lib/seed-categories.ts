import { prisma } from '@/lib/db'

// Misma paleta de 10 colores que usa el selector de categorías en la UI
// (components/CategoriesClient.tsx) — un color por grupo, reutilizado por
// sus subcategorías, para que el número de colores en toda la app no crezca
// sin límite a medida que se añaden categorías.
const GROUPS = [
  { name: 'Alimentacion',  icon: 'UtensilsCrossed', color: '#F97316', children: ['Supermercado', 'Restaurantes', 'Delivery'] },
  { name: 'Movilidad',     icon: 'Car',             color: '#3B82F6', children: ['Transporte', 'Gasolina'] },
  { name: 'Compras',       icon: 'ShoppingBag',     color: '#A855F7', children: ['Compras Online', 'Ropa', 'Hogar'] },
  { name: 'Digital',       icon: 'Wifi',            color: '#14B8A6', children: ['Suscripciones', 'Telecomunicaciones'] },
  { name: 'Bienestar',     icon: 'HeartPulse',      color: '#22C55E', children: ['Salud', 'Deporte'] },
  { name: 'Casa',          icon: 'Home',            color: '#EAB308', children: ['Vivienda', 'Utilities', 'Seguros'] },
  { name: 'Finanzas',      icon: 'Landmark',        color: '#EC4899', children: ['Transferencias', 'Efectivo', 'Ingreso'] },
  // Inversión: ahorro, no gasto (ver lib/investment.ts). Nombre reservado, no se renombra ni borra
  { name: 'Inversión',     icon: 'LineChart',       color: '#6366F1', children: ['Inversión general'] },
]

const CHILD_ICONS: Record<string, string> = {
  Supermercado: 'ShoppingCart', Restaurantes: 'Utensils', Delivery: 'Bike',
  Transporte: 'Bus', Gasolina: 'Fuel',
  'Compras Online': 'Package', Ropa: 'Shirt', Hogar: 'Sofa',
  Suscripciones: 'Radio', Telecomunicaciones: 'Signal',
  Salud: 'Stethoscope', Deporte: 'Dumbbell',
  Vivienda: 'Building2', Utilities: 'Zap', Seguros: 'Shield',
  Transferencias: 'ArrowLeftRight', Efectivo: 'Banknote', Ingreso: 'TrendingUp', 'Inversión general': 'LineChart',
}

// Cada subcategoría hereda el color exacto de su grupo padre; el icono se
// mantiene distinto por subcategoría para conservar su identidad visual.
const CATEGORIES = [
  ...GROUPS.flatMap((group) =>
    group.children.map((name) => ({ name, icon: CHILD_ICONS[name], color: group.color }))
  ),
  { name: 'Otro', icon: 'HelpCircle', color: '#6B7280' },
]

export async function seedDefaultCategories(userId: string) {
  const existing = await prisma.category.count({ where: { userId } })
  if (existing > 0) return

  for (const cat of CATEGORIES) {
    await prisma.category.create({
      data: {
        userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      },
    })
  }

  for (const group of GROUPS) {
    const groupRecord = await prisma.category.create({
      data: { userId, name: group.name, icon: group.icon, color: group.color, isDefault: false, isGroup: true },
    })
    for (const childName of group.children) {
      const child = await prisma.category.findFirst({ where: { name: childName, userId } })
      if (child) {
        await prisma.category.update({ where: { id: child.id }, data: { parentId: groupRecord.id } })
      }
    }
  }
}
