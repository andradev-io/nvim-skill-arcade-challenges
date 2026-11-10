/** Pure helpers for the score API: the public user code, and what a submission may contain. */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * The only thing a user is known by: a code derived from the Keycloak subject. It reveals nothing about the account,
 * and the same user always gets the same code. A `user_code` claim from the realm wins when present.
 */
export async function userCodeFor(sub: string, claim: unknown, salt = ''): Promise<string> {
  if (typeof claim === 'string' && /^[A-Z0-9-]{6,24}$/.test(claim)) return claim
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${sub}`)))
  let out = ''
  for (let i = 0; i < 10; i += 1) out += ALPHABET[digest[i] % ALPHABET.length]
  return `${out.slice(0, 5)}-${out.slice(5)}`
}

export interface Submission {
  challenge: string
  keys: number
  ms: number
}

export type Parsed = { ok: true; value: Submission } | { ok: false; error: string }

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/

/** What the plugin or site may send. The numbers are claims, so only sanity limits apply. */
export function parseSubmission(body: unknown): Parsed {
  if (!body || typeof body !== 'object') return { ok: false, error: 'expected a JSON object' }
  const b = body as Record<string, unknown>
  if (typeof b.challenge !== 'string' || !ID.test(b.challenge)) return { ok: false, error: 'challenge must be a challenge id' }
  if (!Number.isInteger(b.keys) || (b.keys as number) < 1 || (b.keys as number) > 5000) return { ok: false, error: 'keys must be 1 to 5000' }
  if (!Number.isInteger(b.ms) || (b.ms as number) < 200 || (b.ms as number) > 3_600_000) return { ok: false, error: 'ms must be 200 to 3600000' }
  return { ok: true, value: { challenge: b.challenge, keys: b.keys as number, ms: b.ms as number } }
}

/** Is `next` a better result than `prev`? Fewer keys wins, then less time. */
export function isBetter(next: { keys: number; ms: number }, prev: { keys: number; ms: number } | null): boolean {
  if (!prev) return true
  return next.keys < prev.keys || (next.keys === prev.keys && next.ms < prev.ms)
}
