import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMe, fetchStats } from './api'
import { afterLoginUrl, callbackError, isAuthCallback } from './callback'
import { readAuthConfig } from './config'

describe('readAuthConfig', () => {
  it('is off unless both the issuer and the API are set', () => {
    expect(readAuthConfig({})).toBeNull()
    expect(readAuthConfig({ VITE_KEYCLOAK_ISSUER: 'https://auth.example.com/realms/a' })).toBeNull()
    expect(readAuthConfig({ VITE_ARCADE_API: 'https://api.example.com' })).toBeNull()
  })

  it('refuses values that are not URLs', () => {
    expect(readAuthConfig({ VITE_KEYCLOAK_ISSUER: 'REPLACE', VITE_ARCADE_API: 'https://api.example.com' })).toBeNull()
  })

  it('trims trailing slashes and defaults the client id', () => {
    const c = readAuthConfig({ VITE_KEYCLOAK_ISSUER: ' https://auth.example.com/realms/a/ ', VITE_ARCADE_API: 'https://api.example.com//' })
    expect(c).toEqual({ issuer: 'https://auth.example.com/realms/a', api: 'https://api.example.com', clientId: 'arcade-site' })
  })

  it('takes the client id from the environment', () => {
    const c = readAuthConfig({ VITE_KEYCLOAK_ISSUER: 'https://a.b/realms/c', VITE_ARCADE_API: 'https://x.y', VITE_ARCADE_CLIENT_ID: 'other' })
    expect(c?.clientId).toBe('other')
  })
})

describe('sign-in callback', () => {
  it('recognises a return from Keycloak', () => {
    expect(isAuthCallback('?state=abc&code=xyz')).toBe(true)
    expect(isAuthCallback('?state=abc&error=access_denied')).toBe(true)
  })

  it('ignores ordinary addresses', () => {
    expect(isAuthCallback('')).toBe(false)
    expect(isAuthCallback('?code=1')).toBe(false)
    expect(isAuthCallback('?state=1')).toBe(false)
  })

  it('sends the person to the Account page without the query', () => {
    expect(afterLoginUrl({ origin: 'https://arcade.nvim.andradev.io', pathname: '/' })).toBe('https://arcade.nvim.andradev.io/#/account')
  })

  it('gives short messages for provider errors', () => {
    expect(callbackError('?error=access_denied&state=s')).toBe('Sign-in was cancelled.')
    expect(callbackError('?error=server_error&error_description=secret+detail&state=s')).toBe('Sign-in failed. Try again.')
    expect(callbackError('?code=1&state=s')).toBeNull()
  })
})

describe('fetchMe', () => {
  afterEach(() => vi.unstubAllGlobals())
  const reply = (status: number, body: unknown = {}) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))

  it('sends the access token and returns the code and results', async () => {
    const f = reply(200, { userCode: 'ABCDE-FGHJK', results: [{ challenge: 'dw', keys: 3, ms: 900 }] })
    vi.stubGlobal('fetch', f)
    const me = await fetchMe('https://api.example.com', 'tok')
    expect(f).toHaveBeenCalledWith('https://api.example.com/api/me', { headers: { Authorization: 'Bearer tok' } })
    expect(me).toEqual({ userCode: 'ABCDE-FGHJK', admin: false, results: [{ challenge: 'dw', keys: 3, ms: 900 }] })
  })

  it('passes on whether the user is an admin', async () => {
    vi.stubGlobal('fetch', reply(200, { userCode: 'ABCDE-FGHJK', admin: true, results: [] }))
    expect((await fetchMe('https://a', 't')).admin).toBe(true)
  })

  it('explains a refusal', async () => {
    vi.stubGlobal('fetch', reply(403, { error: 'not an admin' }))
    await expect(fetchStats('https://a', 't', 7)).rejects.toThrow('not allowed')
  })

  it('asks for the stats of a number of days', async () => {
    const f = reply(200, { days: 7, daily: [], pages: [], challenges: [], scores: { players: 0, total: 0, perChallenge: [] } })
    vi.stubGlobal('fetch', f)
    const s = await fetchStats('https://api.example.com', 'tok', 7)
    expect(f).toHaveBeenCalledWith('https://api.example.com/api/admin/stats?days=7', { headers: { Authorization: 'Bearer tok' } })
    expect(s.scores.players).toBe(0)
  })

  it('rejects stats that are not in the expected shape', async () => {
    vi.stubGlobal('fetch', reply(200, { hello: 1 }))
    await expect(fetchStats('https://a', 't', 7)).rejects.toThrow('unexpected')
  })

  it('treats missing results as an empty list', async () => {
    vi.stubGlobal('fetch', reply(200, { userCode: 'ABCDE-FGHJK' }))
    expect((await fetchMe('https://a', 't')).results).toEqual([])
  })

  it('explains a rejected token', async () => {
    vi.stubGlobal('fetch', reply(401, { error: 'bad signature' }))
    await expect(fetchMe('https://a', 't')).rejects.toThrow('Sign in again')
  })

  it('explains an unreachable service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    await expect(fetchMe('https://a', 't')).rejects.toThrow('Could not reach')
  })

  it('rejects an answer without a user code', async () => {
    vi.stubGlobal('fetch', reply(200, {}))
    await expect(fetchMe('https://a', 't')).rejects.toThrow('unexpected')
  })
})
