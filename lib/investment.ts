import { prisma } from './db'

// La categoría raíz "Inversión" (y sus subcategorías) es ahorro, no gasto.
// ponytail: se identifica por nombre; la API impide renombrarla/borrarla/moverla.
export const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const isInvestmentName = (name: string) => normalizeName(name) === 'inversion'

export const inSet = (ids: Set<string>, id: string | null) => id !== null && ids.has(id)

type Tx = { amount: number; categoryId: string | null; category?: { name: string; color: string | null } | null }

/** Separa inversiones del resto. Inversión no es gasto ni ingreso: compras suman a "invertido", ventas restan. */
export function splitInvestment<T extends Tx>(all: T[], invIds: Set<string>) {
  const invTxs = all.filter((t) => inSet(invIds, t.categoryId))
  const txs = all.filter((t) => !inSet(invIds, t.categoryId))
  const buys = invTxs.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)
  const sales = invTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const byDest = new Map<string, { id: string; name: string; color: string; total: number }>()
  for (const tx of invTxs) {
    const cur = byDest.get(tx.categoryId!)
    if (cur) cur.total -= tx.amount
    else byDest.set(tx.categoryId!, { id: tx.categoryId!, name: tx.category?.name ?? 'Inversión', color: tx.category?.color ?? '#26A69A', total: -tx.amount })
  }
  const breakdown = Array.from(byDest.values()).sort((a, b) => b.total - a.total)
  return { txs, investment: { buys, sales, total: buys - sales, breakdown } }
}

/** IDs de la categoría raíz Inversión y de todas sus subcategorías. */
export async function getInvestmentCategoryIds(userId: string): Promise<Set<string>> {
  const roots = await prisma.category.findMany({
    where: { userId, parentId: null },
    select: { id: true, name: true, children: { select: { id: true } } },
  })
  const ids = new Set<string>()
  for (const r of roots) {
    if (!isInvestmentName(r.name)) continue
    ids.add(r.id)
    for (const c of r.children) ids.add(c.id)
  }
  return ids
}
