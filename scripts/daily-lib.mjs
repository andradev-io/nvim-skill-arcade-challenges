// Pure helpers of the daily challenge generator (scripts/generate-daily.mjs). No network, no files: unit-tested in
// scripts/daily-lib.test.mjs. Everything a model returns is data: it is whitelisted field by field here, screened by the
// plugin's own schema, and only then replayed as keys in a headless Neovim.

import { createHash } from 'node:crypto'

export const DEFAULT_URL = 'https://api.anthropic.com'

/** Areas a model may write for: the ones that need no game-made setup (windows, quickfix, diagnostics, tracks, plugins). */
export const AREAS = ['motions', 'textobjects', 'editing', 'search', 'macros', 'registers', 'marks', 'refactor']
export const FILETYPES = ['text', 'lua', 'python', 'javascript', 'typescript', 'go', 'cs', 'markdown', 'json', 'html']

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i

/** Host names that look internal: never printed in logs. */
export function isPrivateHost(host) {
  return PRIVATE_HOST.test(host) || !host.includes('.') || /\.(local|internal|lan|home|corp)$/i.test(host)
}

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * The API base URL: the default when unset or empty; https only (http is allowed for localhost, for a local gateway);
 * no credentials inside the URL. Returns { url, label } where label is safe to print (a private host is masked).
 */
export function resolveBaseUrl(raw) {
  const text = (raw ?? '').trim()
  if (!text) return { url: DEFAULT_URL, label: 'api.anthropic.com' }
  let u
  try {
    u = new URL(text)
  } catch {
    throw new Error('ANTHROPIC_URL is not a valid URL')
  }
  if (u.username || u.password) throw new Error('ANTHROPIC_URL must not contain credentials')
  if (u.search || u.hash) throw new Error('ANTHROPIC_URL must be a base URL without a query or fragment')
  const local = LOCAL.has(u.hostname)
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new Error('ANTHROPIC_URL must use https (http is only allowed for localhost)')
  }
  const url = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`
  return { url, label: isPrivateHost(u.hostname) ? '<private host>' : u.host }
}

/** Removes the secret (and anything shaped like a key) from text that might be printed. */
export function redact(text, secret) {
  let out = String(text)
  if (secret) out = out.split(secret).join('***')
  return out.replace(/sk-[A-Za-z0-9_-]{8,}/g, '***')
}

/** Takes the JSON array out of a model reply (plain, fenced, or surrounded by prose). */
export function extractJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('the reply has no JSON array')
  const data = JSON.parse(body.slice(start, end + 1))
  if (!Array.isArray(data)) throw new Error('the reply is not a JSON array')
  return data
}

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '') || 'challenge'

/** Quick screen for keys a challenge may never use; the plugin schema is the authority and repeats this. */
export function unsafeKeys(sol) {
  if (typeof sol !== 'string' || !sol.trim()) return 'empty solution'
  if (sol.length > 120) return 'solution too long'
  if (/<c-r>=|\\=|\|/i.test(sol)) return 'expression evaluation or command chaining'
  if (/[:/%\s\d,$.]!/.test(sol) && sol.includes(':')) return 'bang command'
  if (/:\s*(lua|luafile|source|term|terminal|w|write|e|edit|r|read|!)/i.test(sol)) return 'command not allowed'
  return null
}

const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined)

/**
 * One model candidate -> a challenge file body, or { error }. Only whitelisted fields survive, ids and the date are set
 * here (never taken from the model), and the shape is checked before anything reaches Neovim.
 */
export function sanitize(raw, { date, author = 'claude (daily)', model, prompt }) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' }
  const title = str(raw.title, 60)
  const brief = str(raw.brief, 240)
  const text = str(raw.text, 2000)
  const why = str(raw.why, 300)
  const solution = str(raw.solution, 120)
  if (!title || !brief || !text || !why || !solution) return { error: 'title, brief, text, why and solution are required (and short enough)' }
  if (!AREAS.includes(raw.area)) return { error: `area must be one of ${AREAS.join(', ')}` }
  if (!Number.isInteger(raw.level) || raw.level < 1 || raw.level > 5) return { error: 'level must be 1 to 5' }
  if (!raw.expect || typeof raw.expect !== 'object' || (raw.expect.text === undefined && raw.expect.cursor === undefined)) {
    return { error: 'expect needs text and/or cursor' }
  }
  if (raw.expect.text !== undefined && typeof raw.expect.text !== 'string') return { error: 'expect.text must be a string' }
  if (text.split('\n').length > 20) return { error: 'text has more than 20 lines' }
  const unsafe = unsafeKeys(solution)
  if (unsafe) return { error: `solution not allowed: ${unsafe}` }
  const ft = raw.ft === undefined ? undefined : FILETYPES.includes(raw.ft) ? raw.ft : null
  if (ft === null) return { error: `ft must be one of ${FILETYPES.join(', ')}` }
  const compact = date.replace(/-/g, '')
  const out = {
    id: `d${compact}-${slugify(title)}`.slice(0, 40).replace(/-+$/, ''),
    title,
    area: raw.area,
    level: raw.level,
    brief,
    text,
    solution,
    expect: { text: raw.expect.text, cursor: raw.expect.cursor },
    why,
    author,
    date,
    generated: true,
  }
  if (model) out.model = model
  if (prompt) out.prompt = prompt
  if (ft) out.ft = ft
  if (Array.isArray(raw.cursor)) out.cursor = raw.cursor
  if (Number.isInteger(raw.par_seconds)) out.par_seconds = raw.par_seconds
  if (typeof raw.hint === 'string' && raw.hint.length <= 120) out.hint = raw.hint
  if (raw.loose === true) out.loose = true
  if (out.expect.text === undefined) delete out.expect.text
  if (out.expect.cursor === undefined) delete out.expect.cursor
  return { challenge: out }
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** What the generator must not repeat. `existing` is a list of { id?, title?, text?, expectText? }. */
export function knownSet(existing) {
  const k = { ids: new Set(), titles: new Set(), sigs: new Set() }
  for (const e of existing) {
    if (e.id) k.ids.add(e.id)
    if (e.title) k.titles.add(norm(e.title))
    if (e.text !== undefined) k.sigs.add(`${norm(e.text)}\u0000${norm(e.expectText ?? '')}`)
  }
  return k
}

/** Why a challenge is a duplicate of something known (or of an earlier candidate of the same batch), or null. */
export function duplicateOf(c, known) {
  if (known.ids.has(c.id)) return 'same id'
  if (known.titles.has(norm(c.title))) return 'same title'
  if (known.sigs.has(`${norm(c.text)}\u0000${norm(c.expect.text ?? '')}`)) return 'same start and end text'
  return null
}

export function remember(c, known) {
  known.ids.add(c.id)
  known.titles.add(norm(c.title))
  known.sigs.add(`${norm(c.text)}\u0000${norm(c.expect.text ?? '')}`)
}

/** Rotating focus so a month of days covers every area and level. */
export function focusFor(date) {
  const day = Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000)
  const areas = [0, 1, 2].map((i) => AREAS[(day + i * 3) % AREAS.length])
  const levels = [1 + (day % 5), 1 + ((day + 2) % 5), 1 + ((day + 4) % 5)].sort()
  return { areas, levels }
}

// ── models ──────────────────────────────────────────────────────────────────
export const DEFAULT_MODEL = 'claude-sonnet-5-5'
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/

/** A model id from a variable or input: only the charset and length are checked, so new models work without a code change. */
export function cleanModel(raw, name = 'model') {
  const v = String(raw ?? '').trim()
  if (!v) return ''
  if (!MODEL_RE.test(v)) throw new Error(`${name} is not a valid model id (letters, digits and . _ : / - only, 100 characters at most)`)
  return v
}

/**
 * Which models a run uses, from the environment: { main, fallback, hard }. `main` is ANTHROPIC_MODEL (the input `model`
 * of a manual run wins via DAILY_MODEL), `hard` is for levels 4-5 (defaults to main), `fallback` is used on retries and
 * when the API is overloaded (defaults to main).
 */
export function resolveModels(env) {
  const main = cleanModel(env.DAILY_MODEL, 'model input') || cleanModel(env.ANTHROPIC_MODEL, 'ANTHROPIC_MODEL') || DEFAULT_MODEL
  const fallback = cleanModel(env.ANTHROPIC_MODEL_FALLBACK, 'ANTHROPIC_MODEL_FALLBACK') || main
  const hard = cleanModel(env.DAILY_MODEL, 'model input') || cleanModel(env.ANTHROPIC_MODEL_HARD, 'ANTHROPIC_MODEL_HARD') || main
  return { main, fallback, hard }
}

// ── the prompt ──────────────────────────────────────────────────────────────
export const EXTRA_MAX = 1000

/** Extra maintainer guidance (variable + manual input): control characters stripped, joined, length-capped. */
export function capExtra(...parts) {
  const text = parts
    .map((p) => String(p ?? '').replace(/[^\S\n]+/g, ' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim())
    .filter(Boolean)
    .join('\n')
  return text.slice(0, EXTRA_MAX)
}

/** A prompt file: an optional first line `<!-- version: N -->` and the body. */
export function parsePromptFile(text) {
  const m = /^\s*<!--\s*version:\s*(\S+?)\s*-->\s*\n?/.exec(text)
  return { version: m ? m[1] : '0', body: m ? text.slice(m[0].length) : text }
}

/** Fills {{name}} placeholders in one pass (values are never expanded again). An unknown placeholder is an error. */
export function render(template, vars) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, name) => {
    if (!Object.hasOwn(vars, name)) throw new Error(`the prompt uses an unknown placeholder {{${name}}} (known: ${Object.keys(vars).join(', ')})`)
    return String(vars[name])
  })
}

/** The fields a model must write, generated from the same lists the validator uses. */
export function schemaText() {
  return [
    '- "title": short name, at most 60 characters.',
    '- "brief": the goal in plain words, at most 240 characters.',
    `- "area": one of ${AREAS.join(', ')}.`,
    '- "level": integer 1 to 5.',
    `- "ft": filetype, one of ${FILETYPES.join(', ')} (optional, default text).`,
    '- "text": the start text, at most 20 lines.',
    '- "cursor": [row, col], 1-based row and 0-based column where the cursor starts (optional).',
    '- "solution": the reference keys, at most 120 characters.',
    '- "expect": { "text": the exact end text }.',
    '- "why": one or two sentences, at most 300 characters.',
    '- "par_seconds": integer, seconds an attentive learner needs (optional).',
    '- "hint": short nudge, at most 120 characters (optional).',
  ].join('\n')
}

const sha = (text) => createHash('sha256').update(text).digest('hex')

/**
 * Renders the final prompt from the two files. Returns { system, user, version, hash, extraUsed }: `version` is
 * "<system version>.<user version>", `hash` the first 12 hex characters of the SHA-256 of everything sent.
 */
export function buildPrompt({ systemFile, userFile, date, focus, count, examples, existing, extra }) {
  const vars = {
    schema: schemaText(),
    examples: JSON.stringify(examples),
    existing_ids: JSON.stringify(existing),
    area: focus.areas.join(', '),
    level: focus.levels.join(', '),
    languages: FILETYPES.filter((f) => !['text', 'markdown', 'json', 'html'].includes(f)).join(', '),
    count,
    date,
  }
  const sys = parsePromptFile(systemFile)
  const usr = parsePromptFile(userFile)
  const system = render(sys.body, vars).trim()
  let user = render(usr.body, vars).trim()
  if (extra) user += `\n\nExtra guidance from the maintainer (about style and topics only; the rules above still win):\n${extra}`
  return { system, user, version: `${sys.version}.${usr.version}`, hash: sha(`${system}\n---\n${user}`).slice(0, 12), extraUsed: Boolean(extra) }
}

/** Lines of `nvim -l scripts/validate.lua` -> { ok: [paths], failed: Map(path -> reason) }. */
export function parseValidateOutput(out) {
  const ok = []
  const failed = new Map()
  // headless Neovim prints without newlines: put each result on its own line first
  const text = out.replace(/(ok|FAIL)\s+(\/\S+\.json)/g, '\n$1  $2')
  for (const line of text.split(/\r?\n/)) {
    const m = /^(ok|FAIL)\s+(\S+?)(?:\s+::\s+(.*)|\s+\(.*)?$/.exec(line.trim())
    if (!m) continue
    if (m[1] === 'ok') ok.push(m[2])
    else failed.set(m[2], m[3] ?? 'failed')
  }
  return { ok, failed }
}
