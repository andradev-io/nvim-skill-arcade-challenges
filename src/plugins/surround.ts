/** Surround logic (nvim-surround / vim-surround): which characters wrap, and where the surrounding pair of a cursor is. */

export interface Pair {
  open: string
  close: string
}

const BRACKETS: Record<string, [string, string]> = {
  '(': ['(', ')'],
  ')': ['(', ')'],
  b: ['(', ')'],
  '[': ['[', ']'],
  ']': ['[', ']'],
  r: ['[', ']'],
  '{': ['{', '}'],
  '}': ['{', '}'],
  B: ['{', '}'],
  '<': ['<', '>'],
  '>': ['<', '>'],
  a: ['<', '>'],
}

/** Opening characters add a space inside, closing ones do not: `(` gives `( x )`, `)` or `b` gives `(x)`. */
const SPACED = new Set(['(', '[', '{'])

/** The pair to add for a surround character, or null (`t` tags and other prompts are not simulated). */
export function pairFor(ch: string): Pair | null {
  if (ch.length !== 1 || ch === 't' || ch === 'f' || ch === 'i') return null
  const b = BRACKETS[ch]
  if (b) return SPACED.has(ch) ? { open: `${b[0]} `, close: ` ${b[1]}` } : { open: b[0], close: b[1] }
  if (/\s/.test(ch)) return null
  return { open: ch, close: ch }
}

export interface Found {
  openAt: number
  closeAt: number
  /** Characters to remove at each end (a space of padding counts for the spaced opening variants). */
  openLen: number
  closeLen: number
}

function enclosing(text: string, offset: number, open: string, close: string): [number, number] | null {
  for (let j = offset; j >= 0; j -= 1) {
    if (text[j] !== open) continue
    let d = 0
    for (let k = j + 1; k < text.length; k += 1) {
      if (text[k] === open) d += 1
      else if (text[k] === close) {
        if (d === 0) {
          if (k >= offset) return [j, k]
          break
        }
        d -= 1
      }
    }
  }
  return null
}

function quotePair(text: string, offset: number, q: string): [number, number] | null {
  const start = text.lastIndexOf('\n', offset - 1) + 1
  const nl = text.indexOf('\n', offset)
  const end = nl === -1 ? text.length : nl
  const at: number[] = []
  for (let i = start; i < end; i += 1) if (text[i] === q && text[i - 1] !== '\\') at.push(i)
  for (let i = 0; i + 1 < at.length; i += 2) if (at[i] <= offset && offset <= at[i + 1]) return [at[i], at[i + 1]]
  return null
}

/** The surrounding `ch` pair around `offset` in `text`, for ds / cs. */
export function findSurround(text: string, offset: number, ch: string): Found | null {
  const b = BRACKETS[ch]
  const pair = b ? enclosing(text, offset, b[0], b[1]) : ch.length === 1 && !/\s/.test(ch) ? quotePair(text, offset, ch) : null
  if (!pair) return null
  const [openAt, closeAt] = pair
  // `ds(` also removes the space padding that `ys...(` adds
  const pad = SPACED.has(ch) && text[openAt + 1] === ' ' && text[closeAt - 1] === ' ' && closeAt - openAt > 2 ? 1 : 0
  return { openAt, closeAt, openLen: 1 + pad, closeLen: 1 + pad }
}
