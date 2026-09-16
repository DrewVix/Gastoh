// Actualiza el color de las categorías existentes para que coincida con la
// paleta de 10 colores del selector de la UI (components/CategoriesClient.tsx),
// en vez de los ~20 colores de Material Design del seed original.
// Cada subcategoría hereda el color exacto de su grupo padre.
//
// Uso:
//   GASTOH_USER=vixlab GASTOH_PASS='...' node scripts/recolor-categories.mjs           # dry-run (no cambia nada)
//   GASTOH_USER=vixlab GASTOH_PASS='...' node scripts/recolor-categories.mjs --apply   # aplica los cambios
//
// Variables de entorno:
//   GASTOH_USER   usuario con el que iniciar sesión (obligatorio)
//   GASTOH_PASS   contraseña (obligatorio)
//   GASTOH_BASE   URL base de la instancia (por defecto https://finance.vixlab.dev)

const USER = process.env.GASTOH_USER
const PASS = process.env.GASTOH_PASS
const BASE = process.env.GASTOH_BASE || 'https://finance.vixlab.dev'
const APPLY = process.argv.includes('--apply')

if (!USER || !PASS) {
  console.error('Faltan GASTOH_USER / GASTOH_PASS')
  process.exit(1)
}

// id de grupo -> nuevo color
const GROUP_COLOR = {
  'cmu2kkd6e0016sddjqezvdamb': '#F97316', // Alimentacion
  'cmu2kkdb2001esddjs5tqgfhu': '#22C55E', // Bienestar
  'cmu2kkdbw001gsddjqhft71d5': '#EAB308', // Casa
  'cmu2kkd8t001asddjolc4499t': '#A855F7', // Compras
  'cmu2kkda5001csddjqby460m1': '#14B8A6', // Digital
  'cmu2kkdd0001isddjeey1qsee': '#EC4899', // Finanzas
  'cmu2kkd7x0018sddjxhnrlt6a': '#3B82F6', // Movilidad
}

// id de subcategoría -> id de su grupo padre
const CHILD_TO_GROUP = {
  'cmu2kkd1c0006sddjiz220am1': 'cmu2kkd6e0016sddjqezvdamb', // Delivery -> Alimentacion
  'cmu2kkd110004sddj14m6r02a': 'cmu2kkd6e0016sddjqezvdamb', // Restaurantes
  'cmu2kkd0p0002sddjkp950ght': 'cmu2kkd6e0016sddjqezvdamb', // Supermercado
  'cmu2kkd3g000ksddjuy4g21yc': 'cmu2kkdb2001esddjs5tqgfhu', // Deporte -> Bienestar
  'cmu2o9qb000034zmupk9jx9bu': 'cmu2kkdb2001esddjs5tqgfhu', // Peluqueria
  'cmu2kkd35000isddj20i2vih2': 'cmu2kkdb2001esddjs5tqgfhu', // Salud
  'cmu2kkd4h000ssddj3pr6aw3z': 'cmu2kkdbw001gsddjqhft71d5', // Seguros -> Casa
  'cmu46g71i00038ih0ufv1mkih': 'cmu2kkdbw001gsddjqhft71d5', // Suministros
  'cmu2kkd3y000osddjqneaxouv': 'cmu2kkdbw001gsddjqhft71d5', // Utilities
  'cmu2kkd3p000msddj3hqo7zon': 'cmu2kkdbw001gsddjqhft71d5', // Vivienda
  'cmu2mfngq0001vfwnfc0joho9': 'cmu2kkdbw001gsddjqhft71d5', // alquiler
  'cmu2oam6h00054zmug9zblsey': 'cmu2kkd8t001asddjolc4499t', // Compra general -> Compras
  'cmu2kkd29000csddjoxtinth5': 'cmu2kkd8t001asddjolc4499t', // Compras Online
  'cmu2kkd5s0012sddjbjb06xef': 'cmu2kkd8t001asddjolc4499t', // Hogar
  'cmu2kkd2k000esddj0cg09syn': 'cmu2kkd8t001asddjolc4499t', // Ropa
  'cmu2ngbeq000hpnhqkezg5cca': 'cmu2kkd8t001asddjolc4499t', // Shisha
  'cmu2kkd2t000gsddjkfuyr4b7': 'cmu2kkda5001csddjqby460m1', // Suscripciones -> Digital
  'cmu2kkd48000qsddjcqyub8ea': 'cmu2kkda5001csddjqby460m1', // Telecomunicaciones
  'cmu2kkd50000wsddjwwcal0ec': 'cmu2kkdd0001isddjeey1qsee', // Efectivo -> Finanzas
  'cmu2kkd59000ysddjedsq04l4': 'cmu2kkdd0001isddjeey1qsee', // Ingreso
  'cmu2kkd5j0010sddjwe3pe57s': 'cmu2kkdd0001isddjeey1qsee', // Inversion
  'cmu2kkd4q000usddjzhkoha6r': 'cmu2kkdd0001isddjeey1qsee', // Transferencias
  'cmu2kkd1u000asddjqn3lmx6i': 'cmu2kkd7x0018sddjxhnrlt6a', // Gasolina -> Movilidad
  'cmu2n6s5i0001pnhqzf4py9z7': 'cmu2kkd7x0018sddjxhnrlt6a', // Letra coche
  'cmu2kkd1l0008sddjgs01uz0u': 'cmu2kkd7x0018sddjxhnrlt6a', // Transporte
}

const OTRO_ID = 'cmu2kkd620014sddjtsvt9wau' // Otro (sin grupo) -> gris neutro
const OTRO_COLOR = '#6B7280'

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return null
  return setCookieHeader.split(';')[0]
}

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  if (!loginRes.ok) {
    console.error('Login fallido:', loginRes.status, await loginRes.text())
    process.exit(1)
  }
  const cookie = extractCookie(loginRes.headers.get('set-cookie'))
  if (!cookie) {
    console.error('No se recibió cookie de sesión')
    process.exit(1)
  }

  const catRes = await fetch(`${BASE}/api/categories`, { headers: { Cookie: cookie } })
  const data = await catRes.json()
  const byId = new Map(data.flat.map((c) => [c.id, c]))

  const updates = [
    ...Object.entries(GROUP_COLOR),
    ...Object.entries(CHILD_TO_GROUP).map(([childId, groupId]) => [childId, GROUP_COLOR[groupId]]),
    [OTRO_ID, OTRO_COLOR],
  ]

  console.log(APPLY ? 'Aplicando cambios...\n' : 'Dry-run (usa --apply para aplicar de verdad)\n')

  let changed = 0, same = 0, missing = 0, failed = 0
  for (const [id, color] of updates) {
    const cat = byId.get(id)
    if (!cat) { console.log(`? ${id}: no encontrada en tu cuenta (¿ya renombrada o borrada?)`); missing++; continue }
    if (cat.color === color) { console.log(`= ${cat.name}: ya en ${color}`); same++; continue }

    if (!APPLY) {
      console.log(`~ ${cat.name}: ${cat.color} -> ${color}`)
      changed++
      continue
    }

    const res = await fetch(`${BASE}/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ color }),
    })
    if (res.ok) { console.log(`✓ ${cat.name}: ${cat.color} -> ${color}`); changed++ }
    else { console.error(`✗ ${cat.name} (${id}): ${res.status} ${await res.text()}`); failed++ }
  }

  console.log(`\n${changed} ${APPLY ? 'actualizadas' : 'a actualizar'}, ${same} ya correctas, ${missing} no encontradas, ${failed} fallidas.`)
}

main()
