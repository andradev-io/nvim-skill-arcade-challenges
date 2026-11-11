/** An admin's request for new AI challenges: validated here, then turned into a workflow_dispatch call on GitHub. */

export const GEN_AREAS = ['motions', 'textobjects', 'editing', 'search', 'macros', 'registers', 'marks', 'refactor'] as const
export const GEN_LANGUAGES = ['lua', 'python', 'javascript', 'typescript', 'go', 'cs'] as const

export interface GenerateRequest {
  count: number
  areas: string[]
  levels: number[]
  languages: string[]
  theme: string
  budgetSeconds: number
  dryRun: boolean
}

type Parsed = { ok: true; value: GenerateRequest } | { ok: false; error: string }

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** Everything is optional; unknown values are rejected (not ignored) so a typo is not silently a different request. */
export function parseGenerate(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'expected a JSON object' }
  const b = body as Record<string, unknown>
  const count = b.count === undefined ? 3 : Number(b.count)
  if (!Number.isInteger(count) || count < 3 || count > 20) return { ok: false, error: 'count must be a whole number from 3 to 20' }
  const areas = list(b.areas).map(String)
  if (areas.some((a) => !(GEN_AREAS as readonly string[]).includes(a))) return { ok: false, error: `areas must be among ${GEN_AREAS.join(', ')}` }
  const levels = list(b.levels).map(Number)
  if (levels.some((l) => !Number.isInteger(l) || l < 1 || l > 5)) return { ok: false, error: 'levels must be whole numbers from 1 to 5' }
  const languages = list(b.languages).map(String)
  if (languages.some((l) => !(GEN_LANGUAGES as readonly string[]).includes(l))) return { ok: false, error: `languages must be among ${GEN_LANGUAGES.join(', ')}` }
  const theme = String(b.theme ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (theme.length > 160) return { ok: false, error: 'theme is at most 160 characters' }
  const budget = b.budgetSeconds === undefined ? 300 : Number(b.budgetSeconds)
  if (!Number.isInteger(budget) || budget < 30 || budget > 900) return { ok: false, error: 'budgetSeconds must be from 30 to 900' }
  return {
    ok: true,
    value: { count, areas: [...new Set(areas)], levels: [...new Set(levels)].sort(), languages: [...new Set(languages)], theme, budgetSeconds: budget, dryRun: b.dryRun !== false },
  }
}

/** The inputs of the "daily challenges" workflow (all strings, as GitHub wants). */
export function dispatchInputs(r: GenerateRequest): Record<string, string> {
  const inputs: Record<string, string> = { dry_run: String(r.dryRun), count: String(r.count), budget_seconds: String(r.budgetSeconds) }
  if (r.areas.length) inputs.areas = r.areas.join(',')
  if (r.levels.length) inputs.levels = r.levels.join(',')
  if (r.languages.length) inputs.languages = r.languages.join(',')
  if (r.theme) inputs.theme = r.theme
  return inputs
}

export interface DispatchEnv {
  GITHUB_DISPATCH_TOKEN?: string
  /** owner/name of the repository that holds the workflow */
  GITHUB_REPO?: string
}

/** Calls GitHub. The token lives only in the Worker; it needs "Actions: read and write" on that one repository. */
export async function dispatchWorkflow(
  env: DispatchEnv,
  r: GenerateRequest,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; url: string } | { ok: false; status: 501 | 502 | 500; error: string }> {
  const repo = env.GITHUB_REPO || 'andradev-io/nvim-skill-arcade-challenges'
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, status: 500, error: 'GITHUB_REPO is not owner/name' }
  if (!env.GITHUB_DISPATCH_TOKEN) return { ok: false, status: 501, error: 'The Worker has no GITHUB_DISPATCH_TOKEN secret yet (see worker/README.md).' }
  const res = await fetcher(`https://api.github.com/repos/${repo}/actions/workflows/daily.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'skill-arcade-api',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: dispatchInputs(r) }),
  })
  if (res.status === 204) return { ok: true, url: `https://github.com/${repo}/actions/workflows/daily.yml` }
  // never relay GitHub's body: it is not meant for the browser
  return { ok: false, status: 502, error: `GitHub answered ${res.status} (is the token valid and allowed to run workflows?)` }
}
