// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { AuthError, verifyToken } from './jwt'
import type { Jwk } from './jwt'
import { isBetter, parseSubmission, userCodeFor } from './scores'

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const ISS = 'https://auth.example.com/realms/arcade'

async function makeKey() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = { ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk), kid: 'k1', use: 'sig' }
  return { pair, jwk }
}

async function sign(priv: CryptoKey, claims: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }) {
  const body = `${enc(header)}.${enc(claims)}`
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, new TextEncoder().encode(body)))
  return `${body}.${Buffer.from(sig).toString('base64url')}`
}

const NOW = 1_800_000_000_000
const good = { iss: ISS, sub: 'user-1', exp: NOW / 1000 + 300, azp: 'arcade-site' }
const opts = (keys: Jwk[]) => ({ issuer: ISS, clients: ['arcade-site', 'arcade-plugin'], now: () => NOW, keys: async () => keys })

describe('verifyToken', () => {
  it('accepts a good token', async () => {
    const { pair, jwk } = await makeKey()
    const c = await verifyToken(await sign(pair.privateKey, good), opts([jwk]))
    expect(c.sub).toBe('user-1')
  })
  it('rejects a bad signature, issuer, expiry and client', async () => {
    const a = await makeKey()
    const b = await makeKey()
    await expect(verifyToken(await sign(b.pair.privateKey, good), opts([a.jwk]))).rejects.toThrow('bad signature')
    await expect(verifyToken(await sign(a.pair.privateKey, { ...good, iss: 'https://evil' }), opts([a.jwk]))).rejects.toThrow('wrong issuer')
    await expect(verifyToken(await sign(a.pair.privateKey, { ...good, exp: NOW / 1000 - 100 }), opts([a.jwk]))).rejects.toThrow('expired')
    await expect(verifyToken(await sign(a.pair.privateKey, { ...good, azp: 'other' }), opts([a.jwk]))).rejects.toThrow('another client')
    await expect(verifyToken(await sign(a.pair.privateKey, { ...good, azp: undefined, aud: ['arcade-plugin'] }), opts([a.jwk]))).resolves.toBeTruthy()
  })
  it('rejects other algorithms and garbage', async () => {
    const { pair, jwk } = await makeKey()
    await expect(verifyToken(await sign(pair.privateKey, good, { alg: 'none' }), opts([jwk]))).rejects.toBeInstanceOf(AuthError)
    await expect(verifyToken('a.b', opts([jwk]))).rejects.toThrow('malformed')
  })
  it('refreshes the keys once when the cached set does not match', async () => {
    const { pair, jwk } = await makeKey()
    const calls: boolean[] = []
    const o = { ...opts([]), keys: async (refresh: boolean) => (calls.push(refresh), refresh ? [jwk] : []) }
    await expect(verifyToken(await sign(pair.privateKey, good), o)).resolves.toBeTruthy()
    expect(calls).toEqual([false, true])
  })
})

describe('scores', () => {
  it('derives a stable, opaque user code', async () => {
    const a = await userCodeFor('abc', undefined, 's')
    expect(a).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/)
    expect(await userCodeFor('abc', undefined, 's')).toBe(a)
    expect(await userCodeFor('abd', undefined, 's')).not.toBe(a)
    expect(await userCodeFor('abc', 'MY-CODE-1')).toBe('MY-CODE-1')
  })
  it('checks a submission', () => {
    expect(parseSubmission({ challenge: 'bracket-the-word', keys: 7, ms: 4200 }).ok).toBe(true)
    expect(parseSubmission({ challenge: 'Bad Id', keys: 7, ms: 4200 }).ok).toBe(false)
    expect(parseSubmission({ challenge: 'x', keys: 0, ms: 4200 }).ok).toBe(false)
    expect(parseSubmission({ challenge: 'x', keys: 3, ms: 5 }).ok).toBe(false)
    expect(parseSubmission(null).ok).toBe(false)
  })
  it('fewer keys wins, then time', () => {
    expect(isBetter({ keys: 5, ms: 9000 }, { keys: 6, ms: 1000 })).toBe(true)
    expect(isBetter({ keys: 6, ms: 900 }, { keys: 6, ms: 1000 })).toBe(true)
    expect(isBetter({ keys: 6, ms: 1000 }, { keys: 6, ms: 1000 })).toBe(false)
    expect(isBetter({ keys: 1, ms: 1 }, null)).toBe(true)
  })
})
