/**
 * Anonymous usage analytics with event batching.
 *
 * Events are buffered in memory and flushed every 10 seconds or when the buffer reaches 10 events.
 * A `beforeunload` handler flushes remaining events. No PII is ever sent: no IP, no user agent,
 * no referrer with query params. Tracking respects Do Not Track and Global Privacy Control.
 *
 * Event types:
 *   - view:             page visit (path only)
 *   - play:             challenge started (done=false) or completed (done=true)
 *   - challenge_abandon: user switched away from a challenge without completing it
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

// ---- session & batching ---------------------------------------------------------------------------

/** A random session id per page load. Never persisted across reloads. */
let sessionId: string | null = null

function getSessionId(): string {
  if (!sessionId) {
    sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
  return sessionId
}

interface BatchEvent {
  type: string
  ts: number
  sid: string
  path?: string
  challenge?: string
  done?: boolean
  area?: string
  level?: number
  keys?: number
  par?: number
  duration_ms?: number
}

const FLUSH_INTERVAL_MS = 10_000
const MAX_BATCH_SIZE = 10

let buffer: BatchEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let unloadRegistered = false

/** Strip any field that could accidentally carry PII. Defense in depth alongside the Worker check. */
function sanitize(e: BatchEvent): BatchEvent {
  const clean = {} as Record<string, unknown>
  const allowed = new Set(['type', 'ts', 'sid', 'path', 'challenge', 'done', 'area', 'level', 'keys', 'par', 'duration_ms'])
  for (const [k, v] of Object.entries(e)) {
    if (allowed.has(k)) clean[k] = v
  }
  return clean as unknown as BatchEvent
}

function enqueue(e: BatchEvent): void {
  buffer.push(sanitize(e))
  if (buffer.length >= MAX_BATCH_SIZE) flush()
}

/** Send buffered events to the Worker. Safe to call multiple times; does nothing when empty. */
export function flush(): void {
  if (buffer.length === 0) return
  if (!authConfig || !import.meta.env.PROD || typeof navigator === 'undefined') {
    buffer = []
    return
  }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (!shouldTrack({ doNotTrack: nav.doNotTrack, globalPrivacyControl: nav.globalPrivacyControl })) {
    buffer = []
    return
  }
  const batch = buffer
  buffer = []
  try {
    void fetch(`${authConfig.api}/api/event`, {
      method: 'POST',
      body: JSON.stringify(batch),
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    /* counting is never worth an error */
  }
}

function startFlushTimer(): void {
  if (flushTimer !== null) return
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
}

function registerUnload(): void {
  if (unloadRegistered) return
  unloadRegistered = true
  window.addEventListener('beforeunload', flush)
  // also flush on visibility hidden (mobile tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

function track(e: Omit<BatchEvent, 'ts' | 'sid'>): void {
  if (!import.meta.env.PROD) return
  startFlushTimer()
  registerUnload()
  enqueue({ ...e, ts: Date.now(), sid: getSessionId() })
}

// ---- public API -----------------------------------------------------------------------------------

export const trackView = (page: string): void => track({ type: 'view', path: page })

export function trackPlay(
  challenge: string,
  done: boolean,
  opts?: { area?: string; level?: number; keys?: number; par?: number },
): void {
  if (!published.has(challenge)) return
  const ev: Omit<BatchEvent, 'ts' | 'sid'> = { type: 'play', challenge, done }
  if (opts?.area) ev.area = opts.area
  if (typeof opts?.level === 'number') ev.level = opts.level
  if (done && typeof opts?.keys === 'number') ev.keys = opts.keys
  if (done && typeof opts?.par === 'number') ev.par = opts.par
  track(ev)
}

export function trackAbandon(challenge: string, area?: string, level?: number): void {
  if (!published.has(challenge)) return
  track({ type: 'challenge_abandon', challenge, area, level })
}

/** Reports how long a session lasted (e.g. terminal page open). Uses the batch with keepalive on unload. */
export function trackSession(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return
  track({ type: 'session', duration_ms: Math.floor(durationMs) })
}