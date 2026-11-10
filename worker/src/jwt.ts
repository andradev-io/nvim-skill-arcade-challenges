/** Verifies a Keycloak access token (RS256) with the realm's public keys. No secret is involved. */

export interface Jwk {
  kid?: string
  kty: string
  alg?: string
  use?: string
  n?: string
  e?: string
}

export interface Claims {
  iss: string
  sub: string
  exp: number
  nbf?: number
  aud?: string | string[]
  azp?: string
  [k: string]: unknown
}

export interface VerifyOptions {
  issuer: string
  /** Accepted client ids: the token's `azp` or `aud` must name one of them. */
  clients: string[]
  /** Seconds of clock difference tolerated. */
  skew?: number
  now?: () => number
  keys: (refresh: boolean) => Promise<Jwk[]>
}

const b64 = (s: string): Uint8Array => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
const json = <T>(s: string): T => JSON.parse(new TextDecoder().decode(b64(s))) as T

export class AuthError extends Error {}

async function verifySignature(jwk: Jwk, signed: string, signature: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, new TextEncoder().encode(signed))
}

/** Returns the claims of a valid token, or throws AuthError. */
export async function verifyToken(token: string, opts: VerifyOptions): Promise<Claims> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new AuthError('malformed token')
  let header: { alg?: string; kid?: string }
  let claims: Claims
  try {
    header = json(parts[0])
    claims = json(parts[1])
  } catch {
    throw new AuthError('malformed token')
  }
  if (header.alg !== 'RS256') throw new AuthError('unsupported algorithm')

  const signed = `${parts[0]}.${parts[1]}`
  const signature = b64(parts[2])
  let ok = false
  // the realm may have rotated its keys: try the cached set, then a fresh one
  for (const refresh of [false, true]) {
    const keys = (await opts.keys(refresh)).filter((k) => k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!header.kid || k.kid === header.kid))
    for (const k of keys) {
      try {
        if (await verifySignature(k, signed, signature)) {
          ok = true
          break
        }
      } catch {
        /* a key that cannot be imported is not a match */
      }
    }
    if (ok) break
  }
  if (!ok) throw new AuthError('bad signature')

  const now = Math.floor((opts.now ?? Date.now)() / 1000)
  const skew = opts.skew ?? 30
  if (claims.iss !== opts.issuer) throw new AuthError('wrong issuer')
  if (typeof claims.exp !== 'number' || claims.exp + skew < now) throw new AuthError('token expired')
  if (typeof claims.nbf === 'number' && claims.nbf - skew > now) throw new AuthError('token not valid yet')
  if (typeof claims.sub !== 'string' || !claims.sub) throw new AuthError('no subject')
  const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : []
  if (!opts.clients.some((c) => c === claims.azp || aud.includes(c))) throw new AuthError('token is for another client')
  return claims
}
