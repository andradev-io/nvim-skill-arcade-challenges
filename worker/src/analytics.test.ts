// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { clampDays, dayOf, fillDays, hasRole, isAdmin, isAdminUser, parseEvent, visitorId } from './analytics'
import worker from './index'
import type { Env } from './index'
import type { Jwk } from './jwt'
import { userCodeFor } from './scores'

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

describe('parseEvent', () => {
  it('accepts a view of a known page and a play of a challenge id', () => {
    expect(parseEvent({ type: 'view', path: 'terminal' })).toEqual({ type: 'view', path: 'terminal' })
    expect(parseEvent({ type: 'play', challenge: 'bracket-the-word', done: true })).toEqual({ type: 'play', challenge: 'bracket-the-word', done: true })
  })
  it('refuses everything else', () => {
    expect(parseEvent({ type: 'view', path: '../etc/passwd' })).toBeNull()
    expect(parseEvent({ type: 'view' })).toBeNull()
    expect(parseEvent({ type: 'play', challenge: 'Bad Id', done: false })).toBeNull()
    expect(parseEvent({ type: 'play', challenge: 'ok', done: 'yes' })).toBeNull()
    expect(parseEvent({ type: 'other' })).toBeNull()
    expect(parseEvent(null)).toBeNull()
  })
})

describe('helpers', () => {
  it('names the UTC day', () => {
    expect(dayOf(Date.UTC(2026, 10, 10, 23, 59))).toBe('2026-11-10')
    expect(dayOf(Date.UTC(2026, 10, 11, 0, 0))).toBe('2026-11-11')
  })
  it('reads the admin list case-insensitively and ignores blanks', () => {
    expect(isAdmin('abcde-fghjk', ' ABCDE-FGHJK , OTHER-CODE1 ')).toBe(true)
    expect(isAdmin('NOPE1-NOPE2', 'ABCDE-FGHJK')).toBe(false)
    expect(isAdmin('ABCDE-FGHJK', undefined)).toBe(false)
    expect(isAdmin('', ' , ')).toBe(false)
  })
  it('limits the number of days', () => {
    expect(clampDays(null)).toBe(30)
    expect(clampDays('abc')).toBe(30)
    expect(clampDays('0')).toBe(30)
    expect(clampDays('7')).toBe(7)
    expect(clampDays('500')).toBe(90)
  })
  it('fills every day, oldest first, with zeros for quiet days', () => {
    const now = Date.UTC(2026, 10, 10, 12)
    const rows = fillDays(3, now, [{ day: '2026-11-10', views: 5 }], [{ day: '2026-11-08', visitors: 2 }], [{ day: '2026-11-09', started: 4, completed: 1 }])
    expect(rows).toEqual([
      { day: '2026-11-08', views: 0, visitors: 2, started: 0, completed: 0 },
      { day: '2026-11-09', views: 0, visitors: 0, started: 4, completed: 1 },
      { day: '2026-11-10', views: 5, visitors: 0, started: 0, completed: 0 },
    ])
  })
  it('makes a visitor id that is stable within a day, changes the next day and does not contain the address', async () => {
    const a = await visitorId('2026-11-10', 's', '203.0.113.9', 'Agent/1')
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(await visitorId('2026-11-10', 's', '203.0.113.9', 'Agent/1')).toBe(a)
    expect(await visitorId('2026-11-11', 's', '203.0.113.9', 'Agent/1')).not.toBe(a)
    expect(await visitorId('2026-11-10', 's', '203.0.113.10', 'Agent/1')).not.toBe(a)
    expect(a).not.toContain('203')
  })
})

// ---- the endpoints, against a fake database ----------------------------------------------------------------

interface Call {
  sql: string
  binds: unknown[]
}

function fakeDb(answers: Record<string, unknown[]> = {}) {
  const calls: Call[] = []
  const db = {
    prepare(sql: string) {
      const s = {
        binds: [] as unknown[],
        bind(...v: unknown[]) {
          s.binds = v
          return s
        },
        first: async () => null,
        all: async () => {
          calls.push({ sql, binds: s.binds })
          const key = Object.keys(answers).find((k) => sql.includes(k))
          return { results: key ? answers[key] : [] }
        },
        run: async () => {
          calls.push({ sql, binds: s.binds })
          return {}
        },
      }
      return s
    },
  }
  return { db, calls }
}

const ISS = 'https://auth.example.com/realms/arcade'
const ORIGIN = 'https://arcade.example.com'
let pair: CryptoKeyPair
let jwk: Jwk

beforeAll(async () => {
  pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  jwk = { ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk), kid: 'k1', use: 'sig' }
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ keys: [jwk] })))
})
afterAll(() => vi.unstubAllGlobals())

async function tokenFor(sub: string, extra: Record<string, unknown> = {}): Promise<string> {
  const body = `${enc({ alg: 'RS256', kid: 'k1' })}.${enc({ iss: ISS, sub, exp: Math.floor(Date.now() / 1000) + 300, azp: 'arcade-site', ...extra })}`
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(body)))
  return `${body}.${Buffer.from(sig).toString('base64url')}`
}

const baseEnv = (db: unknown, extra: Partial<Env> = {}): Env => ({
  DB: db as Env['DB'],
  KEYCLOAK_ISSUER: ISS,
  ALLOWED_CLIENTS: 'arcade-site',
  ALLOWED_ORIGINS: ORIGIN,
  USER_CODE_SALT: 's',
  ...extra,
})

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://api.example.com/api/event', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'text/plain', ...headers }, body: JSON.stringify(body) })

describe('POST /api/event', () => {
  it('counts a view and a visitor without storing the address', async () => {
    const { db, calls } = fakeDb()
    const res = await worker.fetch(post({ type: 'view', path: 'home' }, { 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Agent/1' }), baseEnv(db))
    expect(res.status).toBe(204)
    expect(calls.map((c) => c.sql.split(' ').slice(0, 5).join(' '))).toEqual(expect.arrayContaining([expect.stringContaining('INSERT INTO hits'), expect.stringContaining('INSERT OR IGNORE INTO visitors')]))
    const stored = JSON.stringify(calls.map((c) => c.binds))
    expect(stored).not.toContain('203.0.113.9')
    expect(stored).not.toContain('Agent/1')
    expect(calls.find((c) => c.sql.includes('INTO hits'))?.binds).toEqual([dayOf(Date.now()), 'home'])
  })

  it('counts a started and a finished challenge', async () => {
    const { db, calls } = fakeDb()
    await worker.fetch(post({ type: 'play', challenge: 'only-this-window', done: false }), baseEnv(db))
    await worker.fetch(post({ type: 'play', challenge: 'only-this-window', done: true }), baseEnv(db))
    const binds = calls.filter((c) => c.sql.includes('INTO plays')).map((c) => c.binds.slice(1))
    expect(binds).toEqual([
      ['only-this-window', 1, 0, 0, 0, null],
      ['only-this-window', 0, 1, 0, 0, null],
    ])
  })

  it('ignores other origins, tracking opt-outs and unknown events', async () => {
    const { db, calls } = fakeDb()
    expect((await worker.fetch(post({ type: 'view', path: 'home' }, { Origin: 'https://evil.example' }), baseEnv(db))).status).toBe(403)
    expect((await worker.fetch(post({ type: 'view', path: 'home' }, { DNT: '1' }), baseEnv(db))).status).toBe(204)
    expect((await worker.fetch(post({ type: 'view', path: 'home' }, { 'Sec-GPC': '1' }), baseEnv(db))).status).toBe(204)
    expect((await worker.fetch(post({ type: 'view', path: 'nowhere' }), baseEnv(db))).status).toBe(400)
    expect(calls).toHaveLength(0)
  })
})

describe('GET /api/admin/stats', () => {
  const get = (token?: string, query = '') =>
    new Request(`https://api.example.com/api/admin/stats${query}`, { headers: { Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) } })

  it('needs a token', async () => {
    const { db } = fakeDb()
    expect((await worker.fetch(get(), baseEnv(db))).status).toBe(401)
  })

  it('refuses a signed-in user who is not an admin', async () => {
    const { db, calls } = fakeDb()
    const res = await worker.fetch(get(await tokenFor('someone')), baseEnv(db, { ADMIN_USER_CODES: 'AAAAA-BBBBB' }))
    expect(res.status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('refuses everyone when no admin is configured', async () => {
    const { db } = fakeDb()
    expect((await worker.fetch(get(await tokenFor('admin-sub')), baseEnv(db))).status).toBe(403)
  })

  it('returns the numbers for an admin', async () => {
    const code = await userCodeFor('admin-sub', undefined, 's')
    const { db } = fakeDb({
      'FROM hits WHERE day >= ? GROUP BY path': [{ path: 'home', views: 9 }],
      'FROM scores GROUP BY challenge': [{ challenge: 'dw', players: 2, best_keys: 3 }],
      'COUNT(DISTINCT user_code)': [{ players: 2, scores: 4 }],
    })
    const res = await worker.fetch(get(await tokenFor('admin-sub'), '?days=7'), baseEnv(db, { ADMIN_USER_CODES: code }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { days: number; daily: unknown[]; pages: unknown[]; scores: { players: number; total: number; perChallenge: unknown[] } }
    expect(body.days).toBe(7)
    expect(body.daily).toHaveLength(7)
    expect(body.pages).toEqual([{ path: 'home', views: 9 }])
    expect(body.scores).toEqual({ players: 2, total: 4, perChallenge: [{ challenge: 'dw', players: 2, best_keys: 3 }] })
  })

  it('tells /api/me whether the user is an admin', async () => {
    const code = await userCodeFor('admin-sub', undefined, 's')
    const { db } = fakeDb()
    const me = async (sub: string) =>
      ((await (await worker.fetch(new Request('https://api.example.com/api/me', { headers: { Authorization: `Bearer ${await tokenFor(sub)}`, Origin: ORIGIN } }), baseEnv(db, { ADMIN_USER_CODES: code }))).json()) as { admin: boolean }).admin
    expect(await me('admin-sub')).toBe(true)
    expect(await me('someone')).toBe(false)
  })
})

describe('admin by Keycloak role', () => {
  const env = { ALLOWED_CLIENTS: 'arcade-site,arcade-plugin' }
  it('reads realm roles and the roles of an accepted client', () => {
    expect(hasRole({ realm_access: { roles: ['arcade-admin'] } }, 'arcade-admin', ['arcade-site'])).toBe(true)
    expect(hasRole({ resource_access: { 'arcade-site': { roles: ['arcade-admin'] } } }, 'arcade-admin', ['arcade-site'])).toBe(true)
    expect(hasRole({ resource_access: { other: { roles: ['arcade-admin'] } } }, 'arcade-admin', ['arcade-site'])).toBe(false)
  })
  it('ignores malformed claims and an empty role', () => {
    for (const c of [{}, { realm_access: 'arcade-admin' }, { realm_access: { roles: 'arcade-admin' } }, { resource_access: null }, { realm_access: null }]) {
      expect(hasRole(c as Record<string, unknown>, 'arcade-admin', ['arcade-site'])).toBe(false)
    }
    expect(hasRole({ realm_access: { roles: [''] } }, '', [])).toBe(false)
  })
  it('uses arcade-admin by default, ADMIN_ROLE when set, and the code list as an extra', () => {
    const claims = { realm_access: { roles: ['arcade-admin'] } }
    expect(isAdminUser(claims, 'X', env)).toBe(true)
    expect(isAdminUser(claims, 'X', { ...env, ADMIN_ROLE: 'boss' })).toBe(false)
    expect(isAdminUser({ realm_access: { roles: ['boss'] } }, 'X', { ...env, ADMIN_ROLE: 'boss' })).toBe(true)
    expect(isAdminUser({}, 'ABCDE-FGHJK', { ...env, ADMIN_USER_CODES: 'ABCDE-FGHJK' })).toBe(true)
    expect(isAdminUser({}, 'X', env)).toBe(false)
  })
  it('opens /api/admin/stats and /api/me for a token that carries the role', async () => {
    const { db } = fakeDb()
    const tok = await tokenFor('role-sub', { realm_access: { roles: ['arcade-admin'] } })
    const stats = await worker.fetch(new Request('https://api.example.com/api/admin/stats', { headers: { Origin: ORIGIN, Authorization: `Bearer ${tok}` } }), baseEnv(db))
    expect(stats.status).toBe(200)
    const me = await worker.fetch(new Request('https://api.example.com/api/me', { headers: { Origin: ORIGIN, Authorization: `Bearer ${tok}` } }), baseEnv(db))
    expect(((await me.json()) as { admin: boolean }).admin).toBe(true)
    const plain = await tokenFor('plain-sub')
    expect((await worker.fetch(new Request('https://api.example.com/api/admin/stats', { headers: { Origin: ORIGIN, Authorization: `Bearer ${plain}` } }), baseEnv(db))).status).toBe(403)
  })
})
