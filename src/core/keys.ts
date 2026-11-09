/** Splits Vim key notation into tokens: `ci"x<Esc>` -> c i " x <Esc>. Same rules as the plugin. */
export function tokens(s: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    const m = s.slice(i).match(/^<[\w-]+>/)
    if (s[i] === '<' && m && m[0].length <= 14) {
      out.push(m[0])
      i += m[0].length
    } else {
      const cp = String.fromCodePoint(s.codePointAt(i) as number)
      out.push(cp)
      i += cp.length
    }
  }
  return out
}

export const keyCount = (s: string): number => tokens(s).length

export function keyRank(keys: number, par: number): '' | 'S' | 'A' | 'B' | 'C' {
  if (!par) return ''
  return keys <= par ? 'S' : keys <= par * 1.5 ? 'A' : keys <= par * 2 ? 'B' : 'C'
}
