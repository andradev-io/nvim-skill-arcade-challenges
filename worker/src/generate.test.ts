// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dispatchInputs, dispatchWorkflow, parseGenerate } from './generate'

describe('parseGenerate', () => {
  it('defaults to a safe dry run of 3', () => {
    expect(parseGenerate({})).toEqual({ ok: true, value: { count: 3, areas: [], levels: [], languages: [], theme: '', budgetSeconds: 300, dryRun: true } })
  })
  it('only publishes when dryRun is explicitly false', () => {
    expect(parseGenerate({ dryRun: false })).toMatchObject({ ok: true, value: { dryRun: false } })
    expect(parseGenerate({ dryRun: 'no' })).toMatchObject({ ok: true, value: { dryRun: true } })
  })
  it('rejects values outside the allowed sets and ranges', () => {
    const bad = [{ count: 2 }, { count: 21 }, { count: 4.5 }, { areas: ['nope'] }, { levels: [6] }, { languages: ['cobol'] }, { theme: 'x'.repeat(161) }, { budgetSeconds: 5 }, null, 'x']
    for (const b of bad) expect(parseGenerate(b)).toMatchObject({ ok: false })
  })
  it('cleans the theme and removes duplicates', () => {
    const p = parseGenerate({ theme: '  a\n\tb  ', areas: ['search', 'search'], levels: [3, 1, 3], languages: ['go'] })
    expect(p).toMatchObject({ ok: true, value: { theme: 'a b', areas: ['search'], levels: [1, 3], languages: ['go'] } })
  })
})

describe('dispatch', () => {
  const req = { count: 5, areas: ['search'], levels: [2, 3], languages: ['go', 'cs'], theme: 'invoices', budgetSeconds: 600, dryRun: false }
  it('maps the request to workflow inputs', () => {
    expect(dispatchInputs(req)).toEqual({ dry_run: 'false', count: '5', budget_seconds: '600', areas: 'search', levels: '2,3', languages: 'go,cs', theme: 'invoices' })
  })
  it('needs the token and does not relay GitHub errors', async () => {
    expect(await dispatchWorkflow({}, req)).toMatchObject({ ok: false, status: 501 })
    const fail = (async () => new Response('secret details', { status: 403 })) as unknown as typeof fetch
    const r = await dispatchWorkflow({ GITHUB_DISPATCH_TOKEN: 't' }, req, fail)
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(JSON.stringify(r)).not.toContain('secret details')
  })
  it('sends the token only to api.github.com and reports success on 204', async () => {
    let seen: { url: string; auth: string; body: string } | null = null
    const ok = (async (url: string, init: RequestInit) => {
      seen = { url, auth: String((init.headers as Record<string, string>).Authorization), body: String(init.body) }
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    expect(await dispatchWorkflow({ GITHUB_DISPATCH_TOKEN: 't', GITHUB_REPO: 'o/r' }, req, ok)).toMatchObject({ ok: true })
    expect(seen!.url).toBe('https://api.github.com/repos/o/r/actions/workflows/daily.yml/dispatches')
    expect(seen!.auth).toBe('Bearer t')
    expect(JSON.parse(seen!.body).ref).toBe('main')
  })
})
