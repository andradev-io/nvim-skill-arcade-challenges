/** Calls to the score API. The only identity it ever returns is the derived user code. */

export interface Result {
  challenge: string
  keys: number
  ms: number
}

export interface Me {
  userCode: string
  /** True when this code is on the Worker's admin list: the Admin page is then offered. */
  admin: boolean
  results: Result[]
}

export interface Stats {
  days: number
  daily: { day: string; views: number; visitors: number; started: number; completed: number }[]
  pages: { path: string; views: number }[]
  challenges: { challenge: string; started: number; completed: number }[]
  scores: { players: number; total: number; perChallenge: { challenge: string; players: number; best_keys: number }[] }
}

async function get<T>(api: string, path: string, token: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${api}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    throw new Error('Could not reach the score service. Try again in a moment.')
  }
  if (res.status === 401) throw new Error('Your session was not accepted. Sign in again.')
  if (res.status === 403) throw new Error('This account is not allowed to see that.')
  if (!res.ok) throw new Error(`The score service answered ${res.status}.`)
  return (await res.json()) as T
}

/** Your user code and your best result per challenge. */
export async function fetchMe(api: string, token: string): Promise<Me> {
  const body = await get<Partial<Me>>(api, '/api/me', token)
  if (typeof body.userCode !== 'string') throw new Error('The score service sent something unexpected.')
  return { userCode: body.userCode, admin: body.admin === true, results: Array.isArray(body.results) ? body.results : [] }
}

/** The admin numbers (needs an admin's token). */
export async function fetchStats(api: string, token: string, days: number): Promise<Stats> {
  const body = await get<Partial<Stats>>(api, `/api/admin/stats?days=${days}`, token)
  if (!Array.isArray(body.daily) || !body.scores) throw new Error('The score service sent something unexpected.')
  return { days: body.days ?? days, daily: body.daily, pages: body.pages ?? [], challenges: body.challenges ?? [], scores: body.scores }
}

/** Sends one finished challenge. The service keeps it only when it beats the previous best (fewer keys, then less time). */
export async function submitScore(api: string, token: string, r: Result): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${api}/api/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge: r.challenge, keys: r.keys, ms: r.ms }),
    })
  } catch {
    throw new Error('Could not reach the score service.')
  }
  if (res.status === 401) throw new Error('Your session expired. Sign in again to save results.')
  if (!res.ok) throw new Error(`The score service answered ${res.status}.`)
}

export interface GenerateRequest {
  count: number
  areas: string[]
  levels: number[]
  languages: string[]
  theme: string
  dryRun: boolean
}

/** Asks the Worker to start the AI challenge generator on GitHub (admin only). Resolves to the Actions page to watch it. */
export async function requestGenerate(api: string, token: string, r: GenerateRequest): Promise<{ actions: string; dryRun: boolean }> {
  let res: Response
  try {
    res = await fetch(`${api}/api/admin/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(r),
    })
  } catch {
    throw new Error('Could not reach the score service.')
  }
  if (res.status === 401) throw new Error('Your session was not accepted. Sign in again.')
  const body = (await res.json().catch(() => ({}))) as { actions?: string; dryRun?: boolean; error?: string }
  if (!res.ok) throw new Error(body.error ?? `The score service answered ${res.status}.`)
  return { actions: body.actions ?? '', dryRun: body.dryRun !== false }
}
