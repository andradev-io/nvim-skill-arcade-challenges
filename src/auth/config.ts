/**
 * Where to sign in and where the score API lives. Both come from build-time variables, so they are not in the
 * repository (the deploy workflow reads them from GitHub secrets). They are public once the site is built: a browser
 * has to know them to log in.
 */
export interface AuthConfig {
  /** The Keycloak realm URL, e.g. https://auth.example.com/realms/arcade */
  issuer: string
  /** The public client of the site in that realm. */
  clientId: string
  /** The score API (Cloudflare Worker), no trailing slash. */
  api: string
}

export interface RawEnv {
  VITE_KEYCLOAK_ISSUER?: string
  VITE_ARCADE_CLIENT_ID?: string
  VITE_ARCADE_API?: string
}

const trimUrl = (s: string | undefined): string => (s ?? '').trim().replace(/\/+$/, '')

/** The configuration, or null when sign-in is not set up (a local build, a fork): the site then hides the login. */
export function readAuthConfig(env: RawEnv): AuthConfig | null {
  const issuer = trimUrl(env.VITE_KEYCLOAK_ISSUER)
  const api = trimUrl(env.VITE_ARCADE_API)
  if (!/^https?:\/\//.test(issuer) || !/^https?:\/\//.test(api)) return null
  return { issuer, api, clientId: (env.VITE_ARCADE_CLIENT_ID ?? '').trim() || 'arcade-site' }
}

export const authConfig: AuthConfig | null = readAuthConfig(import.meta.env as RawEnv)
