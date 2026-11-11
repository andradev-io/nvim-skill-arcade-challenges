import { useEffect, useState } from 'react'

const TTL = 60 * 60 * 1000

interface Cached {
  n: number
  at: number
}

const keyOf = (repo: string) => `arcade-stars:${repo}`

/** `1`, `999`, `1.2k`, `12k`: short enough for a header button. */
export function formatStars(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toString()}k`
  return `${Math.floor(n / 1000)}k`
}

/** What the browser remembered: the count, and whether it is still fresh enough not to ask GitHub again. */
export function parseCached(raw: string | null, now: number): { n: number; fresh: boolean } | null {
  if (!raw) return null
  try {
    const c = JSON.parse(raw) as Partial<Cached>
    if (typeof c.n !== 'number' || !Number.isFinite(c.n) || c.n < 0 || typeof c.at !== 'number') return null
    return { n: c.n, fresh: now - c.at < TTL }
  } catch {
    return null
  }
}

function readCache(repo: string) {
  try {
    return parseCached(localStorage.getItem(keyOf(repo)), Date.now())
  } catch {
    return null
  }
}

/**
 * The star count of a GitHub repository (`owner/name`), or null until known. Asked at most once an hour per browser and
 * remembered; if GitHub does not answer (offline, rate limit) the last known value stays, or nothing shows.
 */
export function useStars(repo: string): number | null {
  const [stars, setStars] = useState<number | null>(() => readCache(repo)?.n ?? null)
  useEffect(() => {
    if (readCache(repo)?.fresh) return
    let live = true
    fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { stargazers_count?: unknown } | null) => {
        if (!live || typeof d?.stargazers_count !== 'number') return
        setStars(d.stargazers_count)
        try {
          localStorage.setItem(keyOf(repo), JSON.stringify({ n: d.stargazers_count, at: Date.now() } satisfies Cached))
        } catch {
          /* private mode: it just asks again next time */
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [repo])
  return stars
}
