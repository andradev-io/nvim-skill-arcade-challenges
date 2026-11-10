/** Finds and fetches Neovim config files from a public GitHub repository, in the browser (no backend, no token). */

export interface Source {
  owner: string
  /** null: only a user name was given, so common dotfile repo names are tried. */
  repo: string | null
  ref: string
  /** A single file, or a folder prefix to search in. null: search the whole repo. */
  path: string | null
  isFile: boolean
}

const CONFIG_EXT = /\.(lua|vim)$/i
const COMMON_REPOS = ['dotfiles', 'nvim', '.dotfiles', 'neovim', 'nvim-config', 'config', '.config']
const MAX_FILES = 8
const MAX_BYTES = 300_000

/** Understands: user, user/repo, user/repo/path/file.lua, github.com URLs (repo, blob, tree) and raw URLs. */
export function parseSource(input: string): Source | null {
  let s = input.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  if (!s) return null
  let ref = 'HEAD'
  const raw = /^(?:https?:\/\/)?raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i.exec(s)
  if (raw) return { owner: raw[1], repo: raw[2], ref: raw[3], path: raw[4], isFile: true }
  const web = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i.exec(s)
  if (web) s = web[1]
  const parts = s.split('/').filter(Boolean)
  if (parts.length === 0 || parts.some((p) => /\s/.test(p))) return null
  const [owner, repo] = parts
  if (parts.length === 1) return { owner, repo: null, ref, path: null, isFile: false }
  let rest = parts.slice(2)
  if ((rest[0] === 'blob' || rest[0] === 'tree') && rest.length >= 2) {
    const kind = rest[0]
    ref = rest[1]
    rest = rest.slice(2)
    if (kind === 'blob' && rest.length) return { owner, repo, ref, path: rest.join('/'), isFile: true }
  }
  const path = rest.join('/')
  if (!path) return { owner, repo, ref, path: null, isFile: false }
  return { owner, repo, ref, path, isFile: CONFIG_EXT.test(path) }
}

/** From a repo's file list, the config files most likely to hold keymaps (best first). */
export function pickCandidates(paths: string[], under: string | null = null): string[] {
  const scored: { path: string; score: number }[] = []
  for (const p of paths) {
    if (!CONFIG_EXT.test(p)) continue
    if (under && !p.startsWith(`${under}/`)) continue
    if (/(^|\/)(node_modules|test|tests|spec|docs?|\.github)\//i.test(p)) continue
    const name = p.split('/').pop() ?? ''
    let score = 0
    if (/keymap|keybind|remap|mapping/i.test(name)) score += 3
    else if (/^init\.(lua|vim)$/i.test(name)) score += 2
    else if (/^(options|settings|general|core)\.(lua|vim)$/i.test(name)) score += 1
    if (score === 0) continue
    if (/(^|\/)(\.config\/)?nvim\//i.test(p) || !p.includes('/')) score += 1
    scored.push({ path: p, score: score * 100 - p.length })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FILES)
    .map((x) => x.path)
}

export interface LoadedFile {
  path: string
  text: string
}

type Fetch = typeof fetch

async function getText(f: Fetch, url: string): Promise<string> {
  const res = await f(url)
  if (!res.ok) throw new Error(`${res.status}`)
  const text = await res.text()
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text
}

async function repoPaths(f: Fetch, owner: string, repo: string, ref: string): Promise<string[]> {
  const res = await f(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`)
  if (res.status === 404) throw new Error(`Repository ${owner}/${repo} not found (is it public?).`)
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub rate limit reached. Wait a few minutes, or paste a direct link to the keymaps file.')
  }
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`)
  const body = (await res.json()) as { tree?: { path: string; type: string }[] }
  return (body.tree ?? []).filter((t) => t.type === 'blob').map((t) => t.path)
}

/** Fetch the config files named by `src`. Throws an Error with a message fit for the UI. */
export async function loadSource(src: Source, f: Fetch = fetch): Promise<LoadedFile[]> {
  const raw = (owner: string, repo: string, path: string) =>
    `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(src.ref)}/${path.split('/').map(encodeURIComponent).join('/')}`
  if (src.isFile && src.repo && src.path) {
    try {
      return [{ path: src.path, text: await getText(f, raw(src.owner, src.repo, src.path)) }]
    } catch {
      throw new Error(`Could not read ${src.path} from ${src.owner}/${src.repo}.`)
    }
  }
  const repos = src.repo ? [src.repo] : COMMON_REPOS
  let lastError: Error | null = null
  for (const repo of repos) {
    let paths: string[]
    try {
      paths = await repoPaths(f, src.owner, repo, src.ref)
    } catch (e) {
      lastError = e as Error
      if (/rate limit/.test(lastError.message)) throw lastError
      continue
    }
    const picks = pickCandidates(paths, src.path)
    if (picks.length === 0) {
      lastError = new Error(`No keymap or init files found in ${src.owner}/${repo}. Paste a direct link to the file.`)
      continue
    }
    const files: LoadedFile[] = []
    for (const path of picks) {
      try {
        files.push({ path, text: await getText(f, raw(src.owner, repo, path)) })
      } catch {
        /* skip an unreadable file, keep the rest */
      }
    }
    if (files.length) return files
  }
  throw lastError ?? new Error(`Nothing found for ${src.owner}.`)
}
