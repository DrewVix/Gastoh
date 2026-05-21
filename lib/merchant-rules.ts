export interface MerchantRule {
  id: string
  pattern: string
  matchType: string // 'contains' | 'startsWith' | 'exact'
  canonicalName: string
  priority: number
}

export function applyRules(raw: string, rules: MerchantRule[]): string {
  if (!rules.length) return raw
  const lower = raw.toLowerCase().trim()
  for (const rule of rules) {
    const p = rule.pattern.toLowerCase()
    const matched =
      rule.matchType === 'exact' ? lower === p :
      rule.matchType === 'startsWith' ? lower.startsWith(p) :
      lower.includes(p)
    if (matched) return rule.canonicalName
  }
  return raw
}
