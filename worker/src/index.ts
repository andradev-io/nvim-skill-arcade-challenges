/**
 * Skill Arcade score API (Cloudflare Worker + D1).
 *
 *   GET  /api/leaderboard?challenge=<id>&limit=20   public, top results (user codes only)
 *   GET  /api/me                                    Bearer token: your code and your best results
 *   POST /api/score                                 Bearer token: { challenge, keys, ms }, kept when better
 *
 * Identity is a Keycloak access token, checked with the realm's public keys. Nothing about the account is stored:
 * only a derived user code. Scores are claims made by the client; treat the board as an honor system.
 */
import { AuthError, verifyToken } from './jwt'
import type { Claims, Jwk } from './jwt'
import { isBetter, parseSubmission, userCodeFor } from './scores'

interface Stmt {
  bind: (...v: unknown[]) => Stmt
  first: <T>() => Promise<T | null>
  all: <T>() => Promise<{ results: T[] }>
  run: () => Promise<unknown>
}
export interface Env {
  DB: { prepare: (sql: string) => Stmt }
  /** e.g. https://auth.example.com/realms/arcade */
  KEYCLOAK_ISSUER: string
  /** Comma-separated client ids allowed to call the API (the site, the plugin). */
  ALLOWED_CLIENTS: string
  /** Comma-separated origins allowed by CORS. */
  ALLOWED_ORIGINS: string
  USER_CODE_SALT?: string
}

interface Row {
  keys: number
  ms: number
}

let cache: { at: number; keys: Jwk[] } | null = null
async function realmKeys(env: Env, refresh: boolean): Promise<Jwk[]> {
  if (cache && !refresh && Date.now() - cache.at < 600_000) return cache.keys
  // a forced refresh is limited to once a minute, so a stream of bad tokens cannot hammer Keycloak
  if (cache && refresh && Date.now() - cache.at < 60_000) return cache.keys
  const res = await fetch(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/certs`)
  if (!res.ok) throw new Error(`certs ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  cache = { at: Date.now(), keys: body.keys ?? [] }
  return cache.keys
}

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  const h: Record<string, string> = { Vary: 'Origin' }
  if (allowed.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  }
  return h
}

const reply = (req: Request, env: Env, data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(req, env) } })

async function who(req: Request, env: Env): Promise<{ claims: Claims; code: string }> {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')
  if (!m) throw new AuthError('missing bearer token')
  const claims = await verifyToken(m[1], {
    issuer: env.KEYCLOAK_ISSUER,
    clients: env.ALLOWED_CLIENTS.split(',').map((s) => s.trim()),
    keys: (refresh) => realmKeys(env, refresh),
  })
  return { claims, code: await userCodeFor(claims.sub, claims.user_code, env.USER_CODE_SALT) }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) })
    const url = new URL(req.url)
    try {
      if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
        const challenge = url.searchParams.get('challenge') ?? ''
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20))
        const rows = await env.DB.prepare('SELECT user_code, keys, ms FROM scores WHERE challenge = ? ORDER BY keys ASC, ms ASC LIMIT ?')
          .bind(challenge, limit)
          .all<{ user_code: string; keys: number; ms: number }>()
        return reply(req, env, { challenge, results: rows.results })
      }

      if (req.method === 'GET' && url.pathname === '/api/me') {
        const { code } = await who(req, env)
        const rows = await env.DB.prepare('SELECT challenge, keys, ms FROM scores WHERE user_code = ? ORDER BY challenge')
          .bind(code)
          .all<{ challenge: string; keys: number; ms: number }>()
        return reply(req, env, { userCode: code, results: rows.results })
      }

      if (req.method === 'POST' && url.pathname === '/api/score') {
        const { code } = await who(req, env)
        const parsed = parseSubmission(await req.json().catch(() => null))
        if (!parsed.ok) return reply(req, env, { error: parsed.error }, 400)
        const s = parsed.value
        const prev = await env.DB.prepare('SELECT keys, ms FROM scores WHERE user_code = ? AND challenge = ?').bind(code, s.challenge).first<Row>()
        const better = isBetter(s, prev)
        if (better) {
          await env.DB.prepare(
            'INSERT INTO scores (user_code, challenge, keys, ms, updated_at) VALUES (?, ?, ?, ?, ?) ' +
              'ON CONFLICT(user_code, challenge) DO UPDATE SET keys = excluded.keys, ms = excluded.ms, updated_at = excluded.updated_at',
          )
            .bind(code, s.challenge, s.keys, s.ms, Date.now())
            .run()
        }
        return reply(req, env, { userCode: code, kept: better, best: better ? { keys: s.keys, ms: s.ms } : prev })
      }

      return reply(req, env, { error: 'not found' }, 404)
    } catch (e) {
      if (e instanceof AuthError) return reply(req, env, { error: e.message }, 401)
      return reply(req, env, { error: 'server error' }, 500)
    }
  },
}
