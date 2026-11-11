import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, DEFAULT_URL, EXTRA_MAX, buildPrompt, capExtra, cleanModel, duplicateOf, extractJson, focusFor, knownSet, modelChain, resolveBudgetMs, resolveTimeoutMs, parseValidateOutput, parsePromptFile, redact, render, resolveModels, remember, resolveBaseUrl, sanitize, slugify, unsafeKeys } from './daily-lib.mjs'

const good = {
  title: 'Drop the first mineral',
  brief: 'Remove the first word.',
  area: 'editing',
  level: 1,
  text: 'quartz basalt granite',
  solution: 'dw',
  expect: { text: 'basalt granite' },
  why: 'dw deletes to the next word.',
}

describe('base URL', () => {
  it('defaults when unset or empty', () => {
    expect(resolveBaseUrl(undefined).url).toBe(DEFAULT_URL)
    expect(resolveBaseUrl('  ').url).toBe(DEFAULT_URL)
  })
  it('accepts https and drops a trailing slash', () => {
    expect(resolveBaseUrl('https://gateway.example.com/anthropic/').url).toBe('https://gateway.example.com/anthropic')
  })
  it('allows http only for localhost', () => {
    expect(resolveBaseUrl('http://localhost:8080').url).toBe('http://localhost:8080')
    expect(() => resolveBaseUrl('http://gateway.example.com')).toThrow(/https/)
    expect(() => resolveBaseUrl('ftp://x.example.com')).toThrow()
  })
  it('refuses credentials, queries and junk', () => {
    expect(() => resolveBaseUrl('https://user:pw@example.com')).toThrow(/credentials/)
    expect(() => resolveBaseUrl('https://example.com/?key=1')).toThrow()
    expect(() => resolveBaseUrl('not a url')).toThrow()
  })
  it('masks private hosts in the label', () => {
    expect(resolveBaseUrl('https://10.1.2.3').label).toBe('<private host>')
    expect(resolveBaseUrl('https://gateway.internal').label).toBe('<private host>')
    expect(resolveBaseUrl('https://llm').label).toBe('<private host>')
    expect(resolveBaseUrl('https://api.example.com').label).toBe('api.example.com')
  })
})

describe('redact', () => {
  it('removes the secret and key-shaped text', () => {
    expect(redact('bad key abc123secret here', 'abc123secret')).toBe('bad key *** here')
    expect(redact('x sk-ant-api03-AbCdEfGhIj y', '')).toBe('x *** y')
  })
})

describe('model reply', () => {
  it('finds the array in plain, fenced and chatty replies', () => {
    expect(extractJson('[{"a":1}]')).toEqual([{ a: 1 }])
    expect(extractJson('Here you go:\n```json\n[{"a":1}]\n```\nenjoy')).toEqual([{ a: 1 }])
    expect(() => extractJson('no json here')).toThrow()
  })
})

describe('keys screen', () => {
  it('rejects shell, expressions, chaining and file commands', () => {
    for (const bad of [':%!sort<CR>', ':!ls<CR>', 'i<C-r>=system("x")<CR><Esc>', ':s/a/\\=b/<CR>', ':1d|2d<CR>', ':w<CR>', ':lua x<CR>', ':e f<CR>', '']) {
      expect(unsafeKeys(bad), bad).not.toBeNull()
    }
  })
  it('accepts ordinary editing', () => {
    for (const ok of ['dw', 'ci"x<Esc>', ':%s/a/b/g<CR>', ':3,4m0<CR>', 'qaI- <Esc>jq@a', ':g/x/d<CR>']) expect(unsafeKeys(ok), ok).toBeNull()
  })
})

describe('sanitize', () => {
  it('sets the id and date itself and keeps only whitelisted fields', () => {
    const r = sanitize({ ...good, id: 'evil', date: '1999-01-01', author: 'someone', needs: 'surround', hook: 'rm -rf' }, { date: '2026-11-12' })
    expect(r.challenge).toBeDefined()
    expect(r.challenge.id).toBe('d20261112-drop-the-first-mineral')
    expect(r.challenge.date).toBe('2026-11-12')
    expect(r.challenge.generated).toBe(true)
    expect(r.challenge.needs).toBeUndefined()
    expect(Object.keys(r.challenge)).not.toContain('hook')
  })
  it('rejects bad shapes', () => {
    const d = { date: '2026-11-12' }
    expect(sanitize({ ...good, area: 'track' }, d).error).toMatch(/area/)
    expect(sanitize({ ...good, level: 9 }, d).error).toMatch(/level/)
    expect(sanitize({ ...good, expect: {} }, d).error).toMatch(/expect/)
    expect(sanitize({ ...good, solution: ':!ls<CR>' }, d).error).toMatch(/solution/)
    expect(sanitize({ ...good, ft: 'bash' }, d).error).toMatch(/ft/)
    expect(sanitize({ ...good, text: Array(30).fill('x').join('\n') }, d).error).toMatch(/lines/)
    expect(sanitize(null, d).error).toBeDefined()
  })
  it('keeps ids within the 40 character limit', () => {
    const r = sanitize({ ...good, title: 'x'.repeat(60) }, { date: '2026-11-12' })
    expect(r.challenge.id.length).toBeLessThanOrEqual(40)
    expect(/^[a-z0-9][a-z0-9-]*$/.test(r.challenge.id)).toBe(true)
  })
})

describe('duplicates', () => {
  it('spots a known id, title or start and end text, also inside one batch', () => {
    const known = knownSet([{ id: 'a', title: 'Old Title', text: 'foo bar', expectText: 'bar' }])
    const c = sanitize(good, { date: '2026-11-12' }).challenge
    expect(duplicateOf(c, known)).toBeNull()
    expect(duplicateOf({ ...c, title: 'old   title!' }, known)).toBe('same title')
    expect(duplicateOf({ ...c, id: 'a' }, known)).toBe('same id')
    expect(duplicateOf({ ...c, title: 'other', text: 'FOO bar', expect: { text: 'bar' } }, known)).toBe('same start and end text')
    remember(c, known)
    expect(duplicateOf(c, known)).toBe('same id')
  })
})

describe('focus and parsing', () => {
  it('rotates the focus by day', () => {
    expect(focusFor('2026-11-12')).not.toEqual(focusFor('2026-11-13'))
    expect(focusFor('2026-11-12').levels.every((l) => l >= 1 && l <= 5)).toBe(true)
  })
  it('slugifies', () => {
    expect(slugify('Hello, World! 2')).toBe('hello-world-2')
    expect(slugify('???')).toBe('challenge')
  })
  it('reads the validate output even without newlines', () => {
    const out = 'ok    /tmp/a/x.json  (editing, level 1, par 2 keys)-- INSERT --FAIL  /tmp/a/y.json  :: the reference solution does not satisfy expect\nok    /tmp/a/z.json  (search, level 2, par 9 keys)'
    const r = parseValidateOutput(out)
    expect(r.ok).toEqual(['/tmp/a/x.json', '/tmp/a/z.json'])
    expect(r.failed.get('/tmp/a/y.json')).toMatch(/does not satisfy/)
  })
})

describe('models', () => {
  it('defaults and falls back to the main model', () => {
    expect(resolveModels({})).toEqual({ main: DEFAULT_MODEL, fallback: DEFAULT_MODEL, hard: DEFAULT_MODEL, extra: [] })
    expect(resolveModels({ ANTHROPIC_MODEL: 'm-a' })).toEqual({ main: 'm-a', fallback: 'm-a', hard: 'm-a', extra: [] })
  })
  it('reads fallback and hard, and a run override wins over everything', () => {
    const env = { ANTHROPIC_MODEL: 'm-a', ANTHROPIC_MODEL_FALLBACK: 'm-b', ANTHROPIC_MODEL_HARD: 'm-c' }
    expect(resolveModels(env)).toEqual({ main: 'm-a', fallback: 'm-b', hard: 'm-c', extra: [] })
    expect(resolveModels({ ...env, DAILY_MODEL: 'm-z' }).hard).toBe('m-z')
    expect(resolveModels({ ...env, DAILY_MODEL: 'm-z' }).main).toBe('m-z')
  })
  it('checks only charset and length, so new ids work', () => {
    expect(cleanModel('claude-future-9-0')).toBe('claude-future-9-0')
    expect(cleanModel('  ')).toBe('')
    for (const bad of ['a b', 'x;rm -rf', 'm' + String.fromCharCode(10) + 'x', '-lead', 'a'.repeat(101), '$(x)']) expect(() => cleanModel(bad), bad).toThrow(/model id/)
  })
})

describe('prompt files', () => {
  const vars = { a: 1, b: '{{a}}' }
  it('fills placeholders once and rejects unknown ones', () => {
    expect(render('x {{a}} {{ b }}', vars)).toBe('x 1 {{a}}')
    expect(() => render('{{nope}}', vars)).toThrow(/unknown placeholder/)
  })
  it('reads the version comment', () => {
    expect(parsePromptFile('<!-- version: 3 -->' + String.fromCharCode(10) + 'body')).toEqual({ version: '3', body: 'body' })
    expect(parsePromptFile('body').version).toBe('0')
  })
  it('caps and cleans the extra guidance', () => {
    expect(capExtra('', undefined)).toBe('')
    expect(capExtra('a' + String.fromCharCode(0) + 'b', '  more  ')).toBe('ab' + String.fromCharCode(10) + 'more')
    expect(capExtra('x'.repeat(5000)).length).toBe(EXTRA_MAX)
  })
  it('renders, hashes and appends the extra', () => {
    const args = {
      systemFile: '<!-- version: 2 -->' + String.fromCharCode(10) + 'sys {{schema}}',
      userFile: '<!-- version: 5 -->' + String.fromCharCode(10) + '{{date}} {{count}} {{area}} {{level}} {{languages}} {{examples}} {{existing_ids}}',
      date: '2026-11-12',
      focus: { areas: ['editing'], levels: [1, 2] },
      count: 8,
      examples: [{ t: 1 }],
      existing: [{ id: 'a', title: 'A' }],
    }
    const p = buildPrompt({ ...args, extra: '' })
    expect(p.version).toBe('2.5')
    expect(p.hash).toMatch(/^[0-9a-f]{12}$/)
    expect(p.user).toContain('2026-11-12 8 editing 1, 2')
    expect(p.system).toContain('"area"')
    expect(p.extraUsed).toBe(false)
    const q = buildPrompt({ ...args, extra: 'prefer markdown' })
    expect(q.user).toContain('prefer markdown')
    expect(q.hash).not.toBe(p.hash)
  })
})

describe('provenance', () => {
  it('records the model and prompt on the challenge', () => {
    const r = sanitize(good, { date: '2026-11-12', model: 'm-a', prompt: 'v1.1:abcdef123456' })
    expect(r.challenge.model).toBe('m-a')
    expect(r.challenge.prompt).toBe('v1.1:abcdef123456')
  })
})

describe('model chain and time budgets', () => {
  it('orders the wanted model, the fallback, then the extras, without repeats', () => {
    const models = resolveModels({ ANTHROPIC_MODEL: 'a', ANTHROPIC_MODEL_FALLBACK: 'b', ANTHROPIC_MODELS_EXTRA: 'c, a ,d' })
    expect(modelChain('a', models)).toEqual(['a', 'b', 'c', 'd'])
    expect(modelChain('z', models)).toEqual(['z', 'b', 'c', 'a', 'd'])
  })
  it('clamps the budgets and falls back to the defaults', () => {
    expect(resolveTimeoutMs({})).toBe(90_000)
    expect(resolveTimeoutMs({ DAILY_MODEL_TIMEOUT_SECONDS: '1' })).toBe(10_000)
    expect(resolveBudgetMs({})).toBe(300_000)
    expect(resolveBudgetMs({ DAILY_BATCH_BUDGET_SECONDS: '99999' })).toBe(900_000)
  })
})
