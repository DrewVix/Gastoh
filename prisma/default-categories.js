'use strict'
// Categorías y grupos por defecto — compartido por seed.js y setup-admin.js

const CATEGORIES = [
  { name: 'Supermercado',       icon: 'ShoppingCart',   color: '#4CAF50', keywords: ['mercadona','carrefour','lidl','aldi','dia','eroski','alcampo','consum','hipercor'] },
  { name: 'Restaurantes',       icon: 'Utensils',        color: '#FF9800', keywords: ['restaurante','restaurant','cafeteria','cafeter','mcdonald','pizza','burger','sushi','kebab','kfc','subway'] },
  { name: 'Delivery',           icon: 'Bike',            color: '#FF5722', keywords: ['glovo','uber eats','just eat','deliveroo'] },
  { name: 'Transporte',         icon: 'Bus',             color: '#2196F3', keywords: ['renfe','metro','emt','taxi','uber','cabify','bolt','blablacar','cercanias'] },
  { name: 'Gasolina',           icon: 'Fuel',            color: '#795548', keywords: ['repsol','bp','cepsa','galp','gasolinera','carburante'] },
  { name: 'Compras Online',     icon: 'Package',         color: '#9C27B0', keywords: ['amazon','el corte ingles','fnac','mediamarkt','pccomponentes','aliexpress'] },
  { name: 'Ropa',               icon: 'Shirt',           color: '#E91E63', keywords: ['zara','mango','h&m','primark','pull bear','bershka','stradivarius','shein'] },
  { name: 'Suscripciones',      icon: 'Radio',           color: '#00BCD4', keywords: ['spotify','netflix','disney','hbo','amazon prime','youtube premium','apple'] },
  { name: 'Salud',              icon: 'Stethoscope',     color: '#F44336', keywords: ['farmacia','clinica','medico','dentista','optica','sanitas','adeslas'] },
  { name: 'Deporte',            icon: 'Dumbbell',        color: '#8BC34A', keywords: ['gym','gimnasio','fitness','padel','decathlon'] },
  { name: 'Vivienda',           icon: 'Building2',       color: '#607D8B', keywords: ['alquiler','hipoteca','comunidad','ibi'] },
  { name: 'Utilities',          icon: 'Zap',             color: '#FFC107', keywords: ['endesa','iberdrola','naturgy','gas natural','ibergas'] },
  { name: 'Telecomunicaciones', icon: 'Signal',          color: '#3F51B5', keywords: ['vodafone','movistar','orange','yoigo','masmovil','jazztel'] },
  { name: 'Seguros',            icon: 'Shield',          color: '#009688', keywords: ['seguro','axa','mapfre','mutua'] },
  { name: 'Transferencias',     icon: 'ArrowLeftRight',  color: '#FF6F00', keywords: ['bizum','paypal','transferencia'] },
  { name: 'Efectivo',           icon: 'Banknote',        color: '#78909C', keywords: ['cajero','atm','reintegro'] },
  { name: 'Ingreso',            icon: 'TrendingUp',      color: '#43A047', keywords: ['nomina','salario','sueldo','interest payment','dividend','intereses'] },
  { name: 'Inversion',          icon: 'LineChart',       color: '#26A69A', keywords: ['trade republic','etf','acciones','fondos'] },
  { name: 'Hogar',              icon: 'Sofa',            color: '#A1887F', keywords: ['ikea','leroy merlin','bricomart','brico depot'] },
  { name: 'Otro',               icon: 'HelpCircle',      color: '#9E9E9E', keywords: [] },
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

/**
 * Crea las categorías y grupos por defecto para un usuario.
 * Si el usuario ya tiene categorías, no hace nada.
 */
async function seedCategoriesForUser(prisma, userId) {
  const existing = await prisma.category.count({ where: { userId } })
  if (existing > 0) return

  console.log(`   → Creando categorías para usuario ${userId}...`)

  // Crear subcategorías
  for (const cat of CATEGORIES) {
    await prisma.category.create({
      data: {
        userId,
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
  }

  // Crear grupos padre y asignar hijos
  for (const group of GROUPS) {
    const groupRecord = await prisma.category.create({
      data: { userId, name: group.name, icon: group.icon, color: group.color, isDefault: false },
    })
    for (const childName of group.children) {
      const child = await prisma.category.findFirst({ where: { name: childName, userId } })
      if (child) {
        await prisma.category.update({ where: { id: child.id }, data: { parentId: groupRecord.id } })
      }
    }
  }

  console.log(`   ✓ Categorías creadas`)
}

module.exports = { seedCategoriesForUser }
