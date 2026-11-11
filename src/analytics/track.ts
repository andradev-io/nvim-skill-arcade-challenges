/**
 * Anonymous usage counts: which page was opened, which published challenge was started and finished. Nothing that
 * identifies a person is sent (no cookie, no id, no account), only what the Worker needs to add one to a counter.
 * Off when the browser asks not to be tracked, when the API is not configured, and in local development.
 */
import { authConfig } from '../auth/config'

const published = new Set<string>()

/** The ids of the published challenges; plays of anything else (a draft being written) are not counted. */
export function setPublished(ids: string[]): void {
  published.clear()
  for (const id of ids) published.add(id)
}

/** Reads the published bundle once so plays can be told apart from a draft being written. Fails soft. */
export async function loadPublished(): Promise<void> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}community.json`)
    if (!r.ok) return
    const d = (await r.json()) as { challenges?: { id?: unknown }[]; ai?: { id?: unknown }[] }
    setPublished([...(d.challenges ?? []), ...(d.ai ?? [])].map((c) => c.id).filter((id): id is string => typeof id === 'string'))
  } catch {
    /* counting is never worth an error */
  }
}

export interface Prefs {
  doNotTrack?: string | null
  globalPrivacyControl?: boolean
}

/** False when the browser says "do not track" (DNT or Global Privacy Control). */
export function shouldTrack(prefs: Prefs): boolean {
  return prefs.doNotTrack !== '1' && prefs.globalPrivacyControl !== true
}

function send(body: Record<string, unknown>): void {
  if (!authConfig || !import.meta.env.PROD || typeof navigator === 'undefined') return
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (!shouldTrack({ doNotTrack: nav.doNotTrack, globalPrivacyControl: nav.globalPrivacyControl })) return
  try {
    // text/plain keeps it a "simple" request: no CORS preflight, and keepalive lets it finish while the page changes
    void fetch(`${authConfig.api}/api/event`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => undefined)
  } catch {
    /* counting is never worth an error */
  }
}

export const trackView = (page: string): void => send({ type: 'view', path: page })

export function trackPlay(challenge: string, done: boolean): void {
  if (published.has(challenge)) send({ type: 'play', challenge, done })
}
