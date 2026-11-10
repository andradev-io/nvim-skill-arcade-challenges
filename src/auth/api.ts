/** Calls to the score API. The only identity it ever returns is the derived user code. */

export interface Result {
  challenge: string
  keys: number
  ms: number
}

export interface Me {
  userCode: string
  results: Result[]
}

async function get<T>(api: string, path: string, token: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${api}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    throw new Error('Could not reach the score service. Try again in a moment.')
  }
  if (res.status === 401) throw new Error('Your session was not accepted. Sign in again.')
  if (!res.ok) throw new Error(`The score service answered ${res.status}.`)
  return (await res.json()) as T
}

/** Your user code and your best result per challenge. */
export async function fetchMe(api: string, token: string): Promise<Me> {
  const body = await get<Partial<Me>>(api, '/api/me', token)
  if (typeof body.userCode !== 'string') throw new Error('The score service sent something unexpected.')
  return { userCode: body.userCode, results: Array.isArray(body.results) ? body.results : [] }
}
