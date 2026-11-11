// Daily challenge generator: asks a model for new challenges, keeps only the ones that pass the same gates as a pull
// request (schema + replay of the reference solution in a real headless Neovim, de-duplication), and writes the
// survivors to daily/<id>.json. Nothing here needs npm packages.
//
//   ANTHROPIC_API_KEY   secret, sent only as the x-api-key header of the request
//   ANTHROPIC_URL       base URL (a proxy or gateway); default https://api.anthropic.com; https only (http for localhost)
//   ANTHROPIC_MODEL     default claude-sonnet-5-5
//   DAILY_MOCK=1        no network and no key: a built-in fake reply exercises every gate (also a path to a JSON file)
//   DAILY_DRY_RUN=true  run every gate, print the result, write nothing
//   DAILY_DATE          YYYY-MM-DD (default today, UTC)    DAILY_PUBLISH (default 3)    DAILY_CANDIDATES (default 8)
//   ARCADE_PLUGIN       path of the plugin checkout (default ../nvim-skill-arcade)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  SYSTEM, buildPrompt, duplicateOf, extractJson, focusFor, knownSet, parseValidateOutput, redact, remember, resolveBaseUrl, sanitize,
} from './daily-lib.mjs'

const env = process.env
const log = (msg) => console.log(msg)
const flag = (v) => /^(1|true|yes)$/i.test(String(v ?? ''))
const MIN_DAY = 3 // the plugin only uses a day's own set when it has at least this many

const date = env.DAILY_DATE || new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('DAILY_DATE must be YYYY-MM-DD')
const publish = Math.max(MIN_DAY, Number(env.DAILY_PUBLISH) || 3)
const wanted = Math.max(publish, Number(env.DAILY_CANDIDATES) || 8)
const dry = flag(env.DAILY_DRY_RUN)
const mock = env.DAILY_MOCK
const plugin = env.ARCADE_PLUGIN || '../nvim-skill-arcade'
const dailyDir = 'daily'

// ── what exists already ─────────────────────────────────────────────────────
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}
const existing = []
for (const dir of ['challenges', dailyDir]) {
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const c = readJson(path.join(dir, f))
    if (c) existing.push({ id: c.id, title: c.title, text: c.text, expectText: c.expect?.text })
  }
}
// built-in ids and titles from the plugin sources, so the model is told what the game already teaches
const builtinTitles = []
const chdir = path.join(plugin, 'lua', 'skill_arcade', 'challenges')
if (fs.existsSync(chdir)) {
  for (const f of fs.readdirSync(chdir).filter((n) => n.endsWith('.lua'))) {
    for (const m of fs.readFileSync(path.join(chdir, f), 'utf8').matchAll(/title = "([^"]+)"/g)) {
      builtinTitles.push(m[1])
      existing.push({ title: m[1] })
    }
  }
}
const known = knownSet(existing)

if (fs.existsSync(dailyDir) && fs.readdirSync(dailyDir).some((n) => n.startsWith(`d${date.replace(/-/g, '')}-`))) {
  log(`daily/ already has challenges for ${date}: nothing to do`)
  output(0)
  process.exit(0)
}

// ── the model ───────────────────────────────────────────────────────────────
const MOCK_REPLY = [
  { title: 'Drop the first mineral', brief: 'Remove the first word.', area: 'editing', level: 1, text: 'quartz basalt granite', solution: 'dw', expect: { text: 'basalt granite' }, why: 'dw deletes to the start of the next word.' },
  { title: 'Replace the quoted greeting', brief: 'Replace the quoted text with x.', area: 'textobjects', level: 2, text: 'say "good evening"', solution: 'ci"x<Esc>', expect: { text: 'say "x"' }, why: 'ci" changes what is between the quotes, from anywhere on the line.' },
  { title: 'Join the three rows', brief: 'Join the three lines into one.', area: 'editing', level: 2, text: 'north\neast\nsouth', solution: '3J', expect: { text: 'north east south' }, why: '3J joins three lines with single spaces.' },
  { title: 'Echo the word', brief: 'Append a space and a copy of the word.', area: 'registers', level: 3, text: 'echo', solution: 'yiwA <C-r>0<Esc>', expect: { text: 'echo echo' }, why: 'yiw yanks the word; <C-r>0 pastes register 0 while typing.' },
  { title: 'Unsafe shell filter', brief: 'Rejected: a bang command.', area: 'editing', level: 2, text: 'one\ntwo', solution: ':%!sort<CR>', expect: { text: 'one\ntwo' }, why: 'Must be rejected by the gate.' },
  { title: 'Wrong solution', brief: 'Rejected: the keys do not produce the end text.', area: 'editing', level: 1, text: 'abc def', solution: 'x', expect: { text: 'def' }, why: 'Must fail the replay.' },
  { title: 'Drop the first mineral', brief: 'Rejected: a duplicate title.', area: 'editing', level: 1, text: 'one two', solution: 'dw', expect: { text: 'two' }, why: 'Must be dropped as a duplicate.' },
  { title: 'Already solved', brief: 'Rejected: nothing to do.', area: 'editing', level: 1, text: 'same', solution: 'l', expect: { text: 'same' }, why: 'Must fail: solved at the start.' },
]

async function askModel(messages) {
  if (mock) {
    const file = mock === '1' ? null : mock
    return JSON.stringify(file ? readJson(file) : MOCK_REPLY)
  }
  const key = env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set (use DAILY_MOCK=1 to try the gates without a key)')
  const { url, label } = resolveBaseUrl(env.ANTHROPIC_URL)
  log(`asking ${env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'} at ${label}`)
  let res
  try {
    res = await fetch(`${url}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 4096, system: SYSTEM, messages }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (e) {
    throw new Error(`could not reach the model API: ${redact(e instanceof Error ? e.message : e, key)}`)
  }
  if (!res.ok) throw new Error(`the model API answered ${res.status}: ${redact((await res.text()).slice(0, 200), key)}`)
  const body = await res.json()
  const text = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  if (!text) throw new Error('the model API sent no text')
  return text
}

// ── the gates ───────────────────────────────────────────────────────────────
function replay(dir) {
  // the replay runs the model's keys: it gets no secrets, only what Neovim needs
  const clean = { PATH: env.PATH, HOME: env.HOME || os.homedir(), ARCADE_PLUGIN: plugin, TMPDIR: env.TMPDIR }
  const r = spawnSync('nvim', ['--headless', '-u', 'NONE', '-l', 'scripts/validate.lua', dir], { env: clean, encoding: 'utf8', timeout: 180_000 })
  if (r.error) throw new Error(`could not run nvim: ${r.error.message}`)
  return parseValidateOutput(`${r.stdout}\n${r.stderr}`)
}

const accepted = []
const examples = existing.filter((e) => e.text && e.id).slice(0, 3).map((e) => readJson(path.join('challenges', `${e.id}.json`))).filter(Boolean)
const exampleBodies = examples.map(({ id, title, area, level, brief, text, solution, expect, why, ft }) => ({ title, area, level, ft, brief, text, solution, expect, why, id: undefined }))
let messages = [
  { role: 'user', content: buildPrompt({ date, focus: focusFor(date), count: wanted, examples: exampleBodies, titles: [...existing.map((e) => e.title), ...builtinTitles].filter(Boolean) }) },
]

for (let attempt = 0; attempt <= 2 && accepted.length < wanted; attempt += 1) {
  const reply = await askModel(messages)
  let list
  try {
    list = extractJson(reply)
  } catch (e) {
    log(`attempt ${attempt + 1}: ${e instanceof Error ? e.message : e}`)
    messages = [...messages, { role: 'assistant', content: reply.slice(0, 4000) }, { role: 'user', content: 'Reply with ONLY a JSON array of challenges.' }]
    continue
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-daily-'))
  const byFile = new Map()
  const problems = []
  for (const raw of list.slice(0, wanted * 2)) {
    const s = sanitize(raw, { date })
    if (!s.challenge) {
      problems.push(`${raw?.title ?? '?'}: ${s.error}`)
      continue
    }
    const dup = duplicateOf(s.challenge, known)
    if (dup) {
      problems.push(`${s.challenge.title}: duplicate (${dup})`)
      continue
    }
    remember(s.challenge, known)
    const file = path.join(dir, `${s.challenge.id}.json`)
    fs.writeFileSync(file, JSON.stringify(s.challenge, null, 2))
    byFile.set(file, s.challenge)
  }
  const result = byFile.size ? replay(dir) : { ok: [], failed: new Map() }
  for (const file of result.ok) if (byFile.has(file)) accepted.push(byFile.get(file))
  for (const [file, why] of result.failed) problems.push(`${byFile.get(file)?.title ?? file}: ${why}`)
  fs.rmSync(dir, { recursive: true, force: true })
  log(`attempt ${attempt + 1}: ${result.ok.length} passed, ${problems.length} rejected`)
  for (const p of problems) log(`  rejected  ${p}`)
  if (accepted.length >= wanted || attempt === 2 || mock) break
  messages = [
    ...messages,
    { role: 'assistant', content: reply.slice(0, 4000) },
    { role: 'user', content: `${accepted.length} passed so far. Rejected:\n${problems.join('\n')}\nWrite ${wanted - accepted.length} new, different challenges that avoid these problems. Reply with ONLY a JSON array.` },
  ]
}

// ── result ──────────────────────────────────────────────────────────────────
function output(n) {
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `published=${n}\n`)
}

if (accepted.length < MIN_DAY) {
  log(`only ${accepted.length} challenge(s) passed the gates (need ${MIN_DAY}): publishing nothing today`)
  output(0)
  process.exit(0)
}
const chosen = accepted.slice(0, publish)
log(`${dry ? 'dry run: would publish' : 'publishing'} ${chosen.length} challenge(s) for ${date}:`)
for (const c of chosen) log(`  ${c.id}  (${c.area}, level ${c.level})  ${c.title}`)
if (!dry) {
  fs.mkdirSync(dailyDir, { recursive: true })
  for (const c of chosen) fs.writeFileSync(path.join(dailyDir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`)
}
output(dry ? 0 : chosen.length)
