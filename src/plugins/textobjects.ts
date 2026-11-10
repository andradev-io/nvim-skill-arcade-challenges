/**
 * Extra text objects in the style of mini.ai: `a` argument, `q` any quote, `f` function call.
 * Each returns a [start, end) column range on one line, or null.
 */
export type Range = [number, number]

const OPEN = '([{'
const CLOSE = ')]}'
const isQuote = (c: string) => c === '"' || c === "'" || c === '`'

/** The innermost bracket pair around `col`: [openCol, closeCol]. `pred` can reject a candidate by its opening column. */
function enclosingBrackets(line: string, col: number, pred: (open: number) => boolean = () => true): Range | null {
  const stack: number[] = []
  const pairs: Range[] = []
  let quote = ''
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (quote) {
      if (c === quote && line[i - 1] !== '\\') quote = ''
    } else if (isQuote(c)) quote = c
    else if (OPEN.includes(c)) stack.push(i)
    else if (CLOSE.includes(c) && stack.length) {
      const o = stack.pop() as number
      if (OPEN.indexOf(line[o]) === CLOSE.indexOf(c)) pairs.push([o, i])
    }
  }
  const around = pairs.filter(([o, c]) => o <= col && col <= c && pred(o))
  around.sort((a, b) => a[1] - a[0] - (b[1] - b[0]))
  return around[0] ?? null
}

/** Top-level comma-separated pieces between two bracket columns, as [start, end) ranges of the raw text. */
function splitArgs(line: string, open: number, close: number): Range[] {
  const parts: Range[] = []
  let depth = 0
  let quote = ''
  let from = open + 1
  for (let i = open + 1; i < close; i += 1) {
    const c = line[i]
    if (quote) {
      if (c === quote && line[i - 1] !== '\\') quote = ''
    } else if (isQuote(c)) quote = c
    else if (OPEN.includes(c)) depth += 1
    else if (CLOSE.includes(c)) depth -= 1
    else if (c === ',' && depth === 0) {
      parts.push([from, i])
      from = i + 1
    }
  }
  parts.push([from, close])
  return parts
}

/** `ia` / `aa`: the argument under the cursor. `aa` takes the comma (after it, or before it for the last one). */
export function argumentAt(line: string, col: number, inner: boolean): Range | null {
  const br = enclosingBrackets(line, col)
  if (!br) return null
  const parts = splitArgs(line, br[0], br[1])
  const idx = parts.findIndex(([s, e]) => col >= s && col <= e)
  if (idx === -1) return null
  const [rs, re] = parts[idx]
  const raw = line.slice(rs, re)
  const start = rs + (raw.length - raw.trimStart().length)
  const end = re - (raw.length - raw.trimEnd().length)
  if (end <= start) return null
  if (inner) return [start, end]
  if (idx < parts.length - 1) {
    const next = parts[idx + 1][0]
    return [start, next + (line[next] === ' ' ? 1 : 0)]
  }
  if (idx > 0) return [parts[idx - 1][1], end]
  return [start, end]
}

/** `iq` / `aq`: the nearest quote pair (any of " ' `) around the cursor on the line. */
export function quoteAt(line: string, col: number, inner: boolean): Range | null {
  let best: Range | null = null
  for (const q of ['"', "'", '`']) {
    const at: number[] = []
    for (let i = 0; i < line.length; i += 1) if (line[i] === q && line[i - 1] !== '\\') at.push(i)
    for (let i = 0; i + 1 < at.length; i += 2) {
      const [o, c] = [at[i], at[i + 1]]
      if (o <= col && col <= c && (!best || c - o < best[1] - best[0])) best = [o, c]
    }
  }
  if (!best) return null
  return inner ? [best[0] + 1, best[1]] : [best[0], best[1] + 1]
}

/** `if` / `af`: a call like `name(args)`. `inner` is what is between the parentheses, `af` includes the name. */
export function callAt(line: string, col: number, inner: boolean): Range | null {
  const isCall = (o: number) => line[o] === '(' && o > 0 && /[\w.:]/.test(line[o - 1])
  const br = enclosingBrackets(line, col, isCall)
  if (!br) return null
  if (inner) return [br[0] + 1, br[1]]
  let s = br[0]
  while (s > 0 && /[\w.:]/.test(line[s - 1])) s -= 1
  return [s, br[1] + 1]
}
