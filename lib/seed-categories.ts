import { prisma } from '@/lib/db'

const CATEGORIES = [
  { name: 'Supermercado',       icon: 'ShoppingCart',   color: '#4CAF50' },
  { name: 'Restaurantes',       icon: 'Utensils',        color: '#FF9800' },
  { name: 'Delivery',           icon: 'Bike',            color: '#FF5722' },
  { name: 'Transporte',         icon: 'Bus',             color: '#2196F3' },
  { name: 'Gasolina',           icon: 'Fuel',            color: '#795548' },
  { name: 'Compras Online',     icon: 'Package',         color: '#9C27B0' },
  { name: 'Ropa',               icon: 'Shirt',           color: '#E91E63' },
  { name: 'Suscripciones',      icon: 'Radio',           color: '#00BCD4' },
  { name: 'Salud',              icon: 'Stethoscope',     color: '#F44336' },
  { name: 'Deporte',            icon: 'Dumbbell',        color: '#8BC34A' },
  { name: 'Vivienda',           icon: 'Building2',       color: '#607D8B' },
  { name: 'Utilities',          icon: 'Zap',             color: '#FFC107' },
  { name: 'Telecomunicaciones', icon: 'Signal',          color: '#3F51B5' },
  { name: 'Seguros',            icon: 'Shield',          color: '#009688' },
  { name: 'Transferencias',     icon: 'ArrowLeftRight',  color: '#FF6F00' },
  { name: 'Efectivo',           icon: 'Banknote',        color: '#78909C' },
  { name: 'Ingreso',            icon: 'TrendingUp',      color: '#43A047' },
  { name: 'Inversion',          icon: 'LineChart',       color: '#26A69A' },
  { name: 'Hogar',              icon: 'Sofa',            color: '#A1887F' },
  { name: 'Otro',               icon: 'HelpCircle',      color: '#9E9E9E' },
]

const GROUPS = [
  { name: 'Alimentacion',  icon: 'UtensilsCrossed', color: '#FF9800', children: ['Supermercado', 'Restaurantes', 'Delivery'] },
  { name: 'Movilidad',     icon: 'Car',             color: '#2196F3', children: ['Transporte', 'Gasolina'] },
  { name: 'Compras',       icon: 'ShoppingBag',     color: '#9C27B0', children: ['Compras Online', 'Ropa', 'Hogar'] },
  { name: 'Digital',       icon: 'Wifi',            color: '#00BCD4', children: ['Suscripciones', 'Telecomunicaciones'] },
  { name: 'Bienestar',     icon: 'HeartPulse',      color: '#4CAF50', children: ['Salud', 'Deporte'] },
  { name: 'Casa',          icon: 'Home',            color: '#607D8B', children: ['Vivienda', 'Utilities', 'Seguros'] },
  { name: 'Finanzas',      icon: 'Landmark',        color: '#43A047', children: ['Transferencias', 'Efectivo', 'Ingreso', 'Inversion'] },
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
