/** Insert-mode pairing (nvim-autopairs / mini.pairs): decide what a typed key does, given the characters around the cursor. */

export type PairAction = { type: 'insert'; text: string } | { type: 'skip' } | { type: 'delete-pair' } | null

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }
const word = (c: string | undefined) => !!c && /\w/.test(c)

export function pairAction(key: string, prev: string | undefined, next: string | undefined): PairAction {
  if (key === 'Backspace') return prev && next && PAIRS[prev] === next ? { type: 'delete-pair' } : null
  if (key.length !== 1) return null
  // typing the closing character that is already there steps over it
  if (next === key && (')]}"\'`'.includes(key))) return { type: 'skip' }
  const close = PAIRS[key]
  if (!close) return null
  const quote = key === close
  // quotes: not next to a word character (an apostrophe, or closing a string)
  if (quote && (word(prev) || word(next))) return null
  // brackets: only when what follows is blank, a closer or the end
  if (!quote && next && !/[\s)\]}]/.test(next)) return null
  return { type: 'insert', text: key + close }
}
