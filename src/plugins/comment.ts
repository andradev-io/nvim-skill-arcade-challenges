/** Line commenting, the way Comment.nvim / mini.comment / vim-commentary toggle it. Pure: lines in, lines out. */

export type CommentToken = [prefix: string, suffix: string]

const SLASH: CommentToken = ['//', '']
const HASH: CommentToken = ['#', '']

/** Comment tokens by filetype. */
export const COMMENT_TOKENS: Record<string, CommentToken> = {
  lua: ['--', ''],
  sql: ['--', ''],
  haskell: ['--', ''],
  vim: ['"', ''],
  javascript: SLASH,
  typescript: SLASH,
  javascriptreact: SLASH,
  typescriptreact: SLASH,
  c: SLASH,
  cpp: SLASH,
  cs: SLASH,
  java: SLASH,
  go: SLASH,
  rust: SLASH,
  swift: SLASH,
  kotlin: SLASH,
  php: SLASH,
  python: HASH,
  sh: HASH,
  bash: HASH,
  zsh: HASH,
  yaml: HASH,
  toml: HASH,
  ruby: HASH,
  perl: HASH,
  dockerfile: HASH,
  make: HASH,
  r: HASH,
  elixir: HASH,
  nix: HASH,
  html: ['<!--', '-->'],
  xml: ['<!--', '-->'],
  markdown: ['<!--', '-->'],
  css: ['/*', '*/'],
  scss: ['/*', '*/'],
}

export const FILETYPE_CHOICES = [
  'text', 'lua', 'javascript', 'typescript', 'python', 'sh', 'json', 'markdown', 'html', 'css', 'yaml', 'sql', 'c', 'go', 'rust', 'vim',
]

/** `text` and `json` have no comment syntax; the toggler falls back to `#` so the key still does something. */
export function commentToken(ft: string): CommentToken {
  return COMMENT_TOKENS[ft] ?? HASH
}

const blank = (l: string) => l.trim() === ''
const indentOf = (l: string) => l.length - l.trimStart().length

function isCommented(line: string, [pre, suf]: CommentToken): boolean {
  const t = line.trim()
  return t.startsWith(pre) && (suf === '' || t.endsWith(suf))
}

function uncomment(line: string, [pre, suf]: CommentToken): string {
  const at = indentOf(line)
  let rest = line.slice(at + pre.length)
  if (rest.startsWith(' ')) rest = rest.slice(1)
  if (suf) {
    rest = rest.trimEnd()
    rest = rest.slice(0, rest.length - suf.length)
    if (rest.endsWith(' ')) rest = rest.slice(0, -1)
  }
  return line.slice(0, at) + rest
}

/** Toggle: if every non-blank line is already a comment, remove the comments; otherwise comment them all. */
export function toggleLines(lines: string[], ft: string): string[] {
  const tok = commentToken(ft)
  const live = lines.filter((l) => !blank(l))
  if (live.length === 0) return lines
  if (live.every((l) => isCommented(l, tok))) return lines.map((l) => (blank(l) ? l : uncomment(l, tok)))
  const indent = Math.min(...live.map(indentOf))
  const [pre, suf] = tok
  return lines.map((l) => (blank(l) ? l : `${l.slice(0, indent)}${pre} ${l.slice(indent)}${suf ? ` ${suf}` : ''}`))
}

/** `gco` / `gcO`: a new comment line, and the column where typing starts. */
export function openCommentLine(indent: string, ft: string): { text: string; col: number } {
  const [pre, suf] = commentToken(ft)
  const head = `${indent}${pre} `
  return { text: suf ? `${head} ${suf}` : head, col: head.length }
}
