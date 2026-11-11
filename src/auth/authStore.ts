import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { create } from 'zustand'
import { fetchMe } from './api'
import type { Result } from './api'
import { afterLoginUrl, callbackError, isAuthCallback } from './callback'
import { authConfig } from './config'

/** off: not configured. loading: finishing a sign-in or reading the session. out / in: the two settled states. */
export type AuthStatus = 'off' | 'loading' | 'out' | 'in'

interface AuthStore {
  status: AuthStatus
  userCode: string | null
  admin: boolean
  results: Result[]
  error: string | null
  init: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>
}

let manager: UserManager | null = null
// React StrictMode runs effects twice in development; a sign-in callback can be exchanged only once
let started = false

function userManager(): UserManager | null {
  if (!authConfig) return null
  manager ??= new UserManager({
    authority: authConfig.issuer,
    client_id: authConfig.clientId,
    redirect_uri: `${window.location.origin}/`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: 'code', // authorization code + PKCE (S256); there is no client secret in a browser
    // Only "openid": no profile, no e-mail. The site never learns who you are, only a derived code.
    scope: 'openid',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: true,
    loadUserInfo: false,
  })
  return manager
}

const message = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback)

/** The current access token (renewed by the library when needed), or null when signed out. */
export async function accessToken(): Promise<string | null> {
  const user = await userManager()?.getUser()
  return user && !user.expired ? user.access_token : null
}

/** Asks the score API who the access token belongs to, and puts the answer in the store. */
async function loadIdentity(token: string, set: (p: Partial<AuthStore>) => void) {
  if (!authConfig) return
  try {
    const me = await fetchMe(authConfig.api, token)
    set({ status: 'in', userCode: me.userCode, admin: me.admin, results: me.results, error: null })
  } catch (e) {
    set({ status: 'out', userCode: null, admin: false, results: [], error: message(e, 'Could not load your account.') })
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: authConfig ? 'loading' : 'off',
  userCode: null,
  admin: false,
  results: [],
  error: null,

  /** Run once at start: finish a sign-in that just came back from Keycloak, or restore the session of this tab. */
  init: async () => {
    const um = userManager()
    if (!um || started) return
    started = true
    try {
      if (isAuthCallback(window.location.search)) {
        const failed = callbackError(window.location.search)
        const target = afterLoginUrl(window.location)
        if (failed) {
          window.history.replaceState(null, '', target)
          set({ status: 'out', error: failed })
          return
        }
        const user = await um.signinCallback()
        window.history.replaceState(null, '', target)
        if (user?.access_token) return await loadIdentity(user.access_token, set)
        set({ status: 'out', error: 'Sign-in did not complete. Try again.' })
        return
      }
      const user = await um.getUser()
      if (user && !user.expired) return await loadIdentity(user.access_token, set)
      set({ status: 'out' })
    } catch (e) {
      window.history.replaceState(null, '', afterLoginUrl(window.location))
      set({ status: 'out', error: message(e, 'Sign-in failed. Try again.') })
    }
  },

  login: async () => {
    const um = userManager()
    if (!um) return
    set({ error: null })
    try {
      await um.signinRedirect()
    } catch (e) {
      set({ error: message(e, 'Could not start the sign-in.') })
    }
  },

  logout: async () => {
    const um = userManager()
    set({ status: 'out', userCode: null, admin: false, results: [], error: null })
    if (!um) return
    try {
      await um.signoutRedirect()
    } catch {
      await um.removeUser()
    }
  },
}))
