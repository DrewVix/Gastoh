export type BankType = 'TRADE_REPUBLIC' | 'OPEN_BANK'

export interface TransactionWithCategory {
  id: string
  date: string
  amount: number
  currency: string
  description: string
  merchantName: string | null
  isManual: boolean
  notes: string | null
  source: BankType
  category: {
    id: string
    name: string
    icon: string | null
    color: string | null
  } | null
}

export interface MonthlySummary {
  month: string
  totalExpenses: number
  totalIncome: number
  transactionCount: number
  byCategory: CategoryStat[]
  byBank: BankStat[]
  trend: TrendPoint[]
}

export interface CategoryStat {
  categoryId: string | null
  name: string
  icon: string | null
  color: string | null
  total: number
  count: number
}

export interface BankStat {
  bank: BankType
  total: number
  count: number
}

export interface TrendPoint {
  month: string
  expenses: number
  income: number
}
