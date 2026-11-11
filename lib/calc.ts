// Evalúa expresiones aritméticas simples (+ - * / paréntesis) sin usar eval/Function.
// Admite coma o punto como separador decimal. Devuelve null si la expresión no es válida.
export function evaluateExpression(raw: string): number | null {
  const expr = raw.trim().replace(/,/g, '.')
  if (!expr) return null
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null

  let i = 0

  function skipSpaces() {
    while (expr[i] === ' ') i++
  }

  function parseExpr(): number {
    let value = parseTerm()
    while (true) {
      skipSpaces()
      const c = expr[i]
      if (c === '+') { i++; value += parseTerm() }
      else if (c === '-') { i++; value -= parseTerm() }
      else break
    }
    return value
  }

  function parseTerm(): number {
    let value = parseFactor()
    while (true) {
      skipSpaces()
      const c = expr[i]
      if (c === '*') { i++; value *= parseFactor() }
      else if (c === '/') { i++; value /= parseFactor() }
      else break
    }
    return value
  }

  function parseFactor(): number {
    skipSpaces()
    const c = expr[i]
    if (c === '+') { i++; return parseFactor() }
    if (c === '-') { i++; return -parseFactor() }
    if (c === '(') {
      i++
      const value = parseExpr()
      skipSpaces()
      if (expr[i] !== ')') throw new Error('Paréntesis sin cerrar')
      i++
      return value
    }
    const start = i
    while (i < expr.length && /[0-9.]/.test(expr[i])) i++
    if (i === start) throw new Error('Número esperado')
    return parseFloat(expr.slice(start, i))
  }

  try {
    const result = parseExpr()
    skipSpaces()
    if (i !== expr.length) return null
    return Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}
