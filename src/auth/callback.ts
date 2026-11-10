/**
 * Keycloak sends the browser back to the site root with `?code=...&state=...` (or `?error=...`). The site uses hash
 * routes, so after the code is exchanged the query is dropped and the Account page is shown.
 */
export function isAuthCallback(search: string): boolean {
  const p = new URLSearchParams(search)
  return p.has('state') && (p.has('code') || p.has('error'))
}

/** The address to show once the callback is handled: same page, no query, on the Account route. */
export function afterLoginUrl(loc: { origin: string; pathname: string }): string {
  return `${loc.origin}${loc.pathname}#/account`
}

/** Short text for an error the provider put in the callback, without echoing whatever else was in the URL. */
export function callbackError(search: string): string | null {
  const p = new URLSearchParams(search)
  const e = p.get('error')
  if (!e) return null
  if (e === 'access_denied') return 'Sign-in was cancelled.'
  return 'Sign-in failed. Try again.'
}
