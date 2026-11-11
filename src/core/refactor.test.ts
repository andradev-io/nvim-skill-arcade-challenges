import { describe, expect, it } from 'vitest'
import { linesEqual } from './compare'
import { replay } from './replay'

// Refactor sprints (area "refactor" of the plugin): their reference solutions must also run in the browser's Vim,
// so the Play panel of the draft page can judge them. Same start text, cursor and keys as the built-in challenges.
const SPRINTS: { id: string; text: string; cursor?: [number, number]; keys: string; want: string }[] = [
  { id: 'join-table', text: 'local t = {\n  1,\n  2,\n  3,\n}\nreturn #t', keys: '5J', want: 'local t = { 1, 2, 3, }\nreturn #t' },
  {
    id: 'rename-local',
    text: 'local count = 0\ncount = count + 1\ncount = count + 1\nreturn count',
    keys: ':%s/\\<count\\>/total/g<CR>',
    want: 'local total = 0\ntotal = total + 1\ntotal = total + 1\nreturn total',
  },
  { id: 'add-parameter', text: 'public int Add(int a, int b)', keys: 'f)i, int c<Esc>', want: 'public int Add(int a, int b, int c)' },
  {
    id: 'reorder-fields',
    text: 'type User struct {\n\tName  string\n\tAge   int\n\tEmail string\n}',
    keys: ':4m1<CR>',
    want: 'type User struct {\n\tEmail string\n\tName  string\n\tAge   int\n}',
  },
  {
    id: 'rename-interface',
    text: 'interface User { name: UserName }\nfunction show(u: User): User { return u }',
    keys: ':%s/\\<User\\>/Account/g<CR>',
    want: 'interface Account { name: UserName }\nfunction show(u: Account): Account { return u }',
  },
  { id: 'change-signature', text: 'func scale(x int, y int) int {', keys: 'f(ll4x', want: 'func scale(x, y int) int {' },
  {
    id: 'extract-variable',
    text: 'console.log(price * 1.2 + shipping * 1.2);',
    keys: ':s/1\\.2/rate/g<CR>Oconst rate = 1.2;<Esc>',
    want: 'const rate = 1.2;\nconsole.log(price * rate + shipping * rate);',
  },
  { id: 'swap-arguments', text: 'total := ratio(width, height)', keys: 'f(lcwheight<Esc>wwcwwidth<Esc>', want: 'total := ratio(height, width)' },
  {
    id: 'inline-variable',
    text: 'local a, b = 2, 3\nlocal sum = a + b\nreturn sum * 2',
    keys: 'jwwwy$dd0fsciw(<C-r>0)<Esc>',
    want: 'local a, b = 2, 3\nreturn (a + b) * 2',
  },
  {
    id: 'loop-to-filter',
    text: 'evens = []\nfor n in nums:\n    if n % 2 == 0:\n        evens.append(n)',
    keys: 'ccevens = [n for n in nums if n % 2 == 0]<Esc>j3dd',
    want: 'evens = [n for n in nums if n % 2 == 0]',
  },
  {
    id: 'invert-if',
    text: 'if enabled:\n    start()\nelse:\n    stop()',
    keys: 'winot <Esc>:4m1|4m2<CR>',
    want: 'if not enabled:\n    stop()\nelse:\n    start()',
  },
  {
    id: 'expression-bodied',
    text: 'public int Twice(int x)\n{\n    return x * 2;\n}',
    keys: 'A =><Esc>jddjddkJwdw',
    want: 'public int Twice(int x) => x * 2;',
  },
  {
    id: 'extract-function',
    text: 'local a, b, c, d = 1, 2, 3, 4\nlocal x = (a + b) * 2\nlocal y = (c + d) * 2\nreturn x + y',
    keys: 'Olocal function dbl(s) return s * 2 end<Esc>:3,4s/(\\(\\w\\) + \\(\\w\\)) \\* 2/dbl(\\1 + \\2)/<CR>',
    want: 'local function dbl(s) return s * 2 end\nlocal a, b, c, d = 1, 2, 3, 4\nlocal x = dbl(a + b)\nlocal y = dbl(c + d)\nreturn x + y',
  },
  { id: 'loop-to-map', text: 'const out = [];\nfor (const n of nums) out.push(n * 2);', keys: 'ccconst out = nums.map(n => n * 2);<Esc>jdd', want: 'const out = nums.map(n => n * 2);' },
  { id: 'swap-params', text: 'function area(width, height) {}', keys: 'f(lcwheight<Esc>wwcwwidth<Esc>', want: 'function area(height, width) {}' },
  { id: 'wrap-bracket', text: 'const list = item;', cursor: [1, 13], keys: 'ciw[<C-r>"]<Esc>', want: 'const list = [item];' },
  {
    id: 'callback-to-async',
    text: 'fs.readFile(path, (err, data) => {\n  use(data);\n});',
    keys: 'ccconst data = await fs.readFile(path);<Esc>j<<jdd',
    want: 'const data = await fs.readFile(path);\nuse(data);',
  },
]

describe('refactor sprints in the browser Vim', () => {
  for (const s of SPRINTS) {
    it(s.id, () => {
      const r = replay(s.text, s.cursor ?? [1, 0], s.keys)
      expect(r.unsupported).toBeNull()
      expect(linesEqual(r.text, s.want, true)).toBe(true)
    })
  }
})
