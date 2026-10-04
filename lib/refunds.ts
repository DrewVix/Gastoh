import { prisma } from './db'

// Devoluciones: transacciones positivas vinculadas a un gasto (refundOfId).
// No cuentan como ingreso: se restan del gasto padre, en la fecha y categoría del gasto.

/** Filtro Prisma: excluye las filas que son devoluciones. */
export const notRefund = { refundOfId: null }

/** Select/include Prisma para traer los importes devueltos de cada gasto. */
export const refundAmounts = { refunds: { select: { amount: true } } }

type WithRefunds = { amount: number; refunds?: { amount: number }[] }

export const refundedTotal = (tx: { refunds?: { amount: number }[] }) =>
  (tx.refunds ?? []).reduce((s, r) => s + r.amount, 0)

/** Importe neto del gasto tras restar devoluciones. Nunca pasa a positivo. */
export const netAmount = (tx: WithRefunds) => Math.min(0, tx.amount + refundedTotal(tx))

/** Sustituye el importe de cada transacción por su neto (solo afecta a gastos con devoluciones). */
export function applyRefunds<T extends WithRefunds>(txs: T[]): T[] {
  return txs.map((t) => (t.refunds?.length ? { ...t, amount: netAmount(t) } : t))
}

/**
 * Valida que `amount` (positivo) se pueda devolver contra el gasto `parentId`.
 * `excludeId` permite ignorar la propia devolución al editarla.
 * Devuelve el gasto padre o un mensaje de error.
 */
export async function validateRefund(userId: string, parentId: string, amount: number, excludeId?: string) {
  if (!(amount > 0)) return { error: 'El importe de la devolución debe ser positivo' }
  const parent = await prisma.transaction.findFirst({
    where: { id: parentId, userId },
    select: { id: true, amount: true, isTransfer: true, refundOfId: true, categoryId: true, refunds: { select: { id: true, amount: true } } },
  })
  if (!parent) return { error: 'Gasto no encontrado' }
  if (parent.amount >= 0 || parent.isTransfer || parent.refundOfId) {
    return { error: 'Solo se pueden añadir devoluciones a un gasto' }
  }
  const already = parent.refunds.filter((r) => r.id !== excludeId).reduce((s, r) => s + r.amount, 0)
  const available = Math.round((Math.abs(parent.amount) - already) * 100) / 100
  if (amount > available + 0.005) {
    return { error: `La devolución supera lo pendiente del gasto (${available.toFixed(2)} €)` }
  }
  return { parent }
}
