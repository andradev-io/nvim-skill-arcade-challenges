/**
 * Pure helpers for the anonymous usage counters and the admin stats.
 *
 * What is kept: per day, how many page views each page got, how many distinct visitors there were (a hash that
 * includes the day, so it cannot be followed from one day to the next, and is dropped after 90 days) and how many
 * times each challenge was started and finished. No IP address, no cookie, no account.
 */

/** The pages of the site that may be reported. Anything else is ignored. */
export const PAGES = ['home', 'create', 'terminal', 'support', 'challenges', 'ai', 'account', 'admin'] as const

export type Event = { type: 'view'; path: string } | { type: 'play'; challenge: string; done: boolean }

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/

/** What the site may report, or null for anything else. */
export function parseEvent(body: unknown): Event | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (b.type === 'view') {
    return typeof b.path === 'string' && (PAGES as readonly string[]).includes(b.path) ? { type: 'view', path: b.path } : null
  }
  if (b.type === 'play') {
    return typeof b.challenge === 'string' && ID.test(b.challenge) && typeof b.done === 'boolean'
      ? { type: 'play', challenge: b.challenge, done: b.done }
      : null
  }
  return null
}

/** UTC calendar day, `2026-11-10`. */
export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/** A visitor for one day only: the same browser gets another value tomorrow. The address itself is never stored. */
export async function visitorId(day: string, salt: string, ip: string, agent: string): Promise<string> {
  const data = new TextEncoder().encode(`${day}|${salt}|${ip}|${agent}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Is this user code on the admin list (`ADMIN_USER_CODES`, comma separated)? */
export function isAdmin(code: string, list: string | undefined): boolean {
  if (!list) return false
  return list
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .includes(code.toUpperCase())
}

/** The realm role that makes someone an admin when `ADMIN_ROLE` is not set. */
export const DEFAULT_ADMIN_ROLE = 'arcade-admin'

/**
 * Does the (already verified) token carry this role? A realm role comes in `realm_access.roles`; a client role
 * (on any client the Worker accepts) comes in `resource_access.<client>.roles`.
 */
export function hasRole(claims: Record<string, unknown>, role: string, clients: string[]): boolean {
  if (!role) return false
  const roles = (v: unknown): unknown[] => {
    const list = (v as { roles?: unknown } | null | undefined)?.roles
    return Array.isArray(list) ? list : []
  }
  if (roles(claims.realm_access).includes(role)) return true
  const res = claims.resource_access
  if (typeof res !== 'object' || res === null) return false
  return clients.some((c) => roles((res as Record<string, unknown>)[c]).includes(role))
}

/** Admin = holds the Keycloak role (set it on the user in the realm, no deploy), or is listed in `ADMIN_USER_CODES`. */
export function isAdminUser(
  claims: Record<string, unknown>,
  code: string,
  env: { ADMIN_ROLE?: string; ADMIN_USER_CODES?: string; ALLOWED_CLIENTS: string },
): boolean {
  const role = (env.ADMIN_ROLE ?? DEFAULT_ADMIN_ROLE).trim()
  const clients = env.ALLOWED_CLIENTS.split(',').map((s) => s.trim()).filter(Boolean)
  return hasRole(claims, role, clients) || isAdmin(code, env.ADMIN_USER_CODES)
}

/** How many days of history to return: 1 to 90, 30 when missing or not a number. */
export function clampDays(v: string | null): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(90, n) : 30
}

export interface DayRow {
  day: string
  views: number
  visitors: number
  started: number
  completed: number
}

/** One row per day for the last `days` days, oldest first, zeros where nothing happened. */
export function fillDays(
  days: number,
  now: number,
  views: { day: string; views: number }[],
  visitors: { day: string; visitors: number }[],
  plays: { day: string; started: number; completed: number }[],
): DayRow[] {
  const v = new Map(views.map((r) => [r.day, r.views]))
  const u = new Map(visitors.map((r) => [r.day, r.visitors]))
  const p = new Map(plays.map((r) => [r.day, r]))
  const out: DayRow[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = dayOf(now - i * 86_400_000)
    out.push({ day, views: v.get(day) ?? 0, visitors: u.get(day) ?? 0, started: p.get(day)?.started ?? 0, completed: p.get(day)?.completed ?? 0 })
  }
  return out
}
