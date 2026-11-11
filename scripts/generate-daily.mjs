// Daily challenge generator: asks a model for new challenges, keeps only the ones that pass the same gates as a pull
// request (schema + replay of the reference solution in a real headless Neovim, de-duplication), and writes the
// survivors to daily/<id>.json. Nothing here needs npm packages.
//
//   ANTHROPIC_API_KEY         secret, sent only as the x-api-key header of the request
//   ANTHROPIC_URL             base URL (a proxy or gateway); default https://api.anthropic.com; https only (http for localhost)
//   ANTHROPIC_MODEL           the generator model (default claude-sonnet-5-5)
//   ANTHROPIC_MODEL_FALLBACK  used on retries and when the API is overloaded (default: same as ANTHROPIC_MODEL)
//   ANTHROPIC_MODEL_HARD      used for levels 4-5 (default: same as ANTHROPIC_MODEL)
//   DAILY_MODEL               one-run override of all of the above (the workflow input `model`)
//   DAILY_PROMPT_EXTRA        extra guidance appended to the prompt (repo variable), DAILY_PROMPT_EXTRA_RUN for one run
//   DAILY_MOCK=1              no network and no key: a built-in fake reply exercises every gate (also a path to a JSON file)
//   DAILY_DRY_RUN=true        run every gate, print the result, write nothing
//   DAILY_DATE                YYYY-MM-DD (default today, UTC)    DAILY_PUBLISH (default 3)    DAILY_CANDIDATES (default 8)
//   DAILY_PR_BODY             path where the pull request description is written
//   ARCADE_PLUGIN             path of the plugin checkout (default ../nvim-skill-arcade)
//
//   node scripts/generate-daily.mjs --print-prompt    render the final prompt (no key, no network) and exit
//
// The prompt lives in daily/prompt/system.md and daily/prompt/user.md.tmpl: edit them with a pull request.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildPrompt, capExtra, duplicateOf, extractJson, focusFor, knownSet, parseValidateOutput, redact, remember, resolveBaseUrl,
  resolveModels, sanitize,
} from './daily-lib.mjs'

const env = process.env
const log = (msg) => console.log(msg)
const flag = (v) => /^(1|true|yes)$/i.test(String(v ?? ''))
const MIN_DAY = 3 // the plugin only uses a day's own set when it has at least this many
const printPrompt = process.argv.includes('--print-prompt')

const date = env.DAILY_DATE || new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('DAILY_DATE must be YYYY-MM-DD')
const publish = Math.max(MIN_DAY, Number(env.DAILY_PUBLISH) || 3)
const wanted = Math.max(publish, Number(env.DAILY_CANDIDATES) || 8)
const dry = flag(env.DAILY_DRY_RUN)
const mock = env.DAILY_MOCK
const plugin = env.ARCADE_PLUGIN || '../nvim-skill-arcade'
const dailyDir = 'daily'
const models = resolveModels(env)
const extra = capExtra(env.DAILY_PROMPT_EXTRA, env.DAILY_PROMPT_EXTRA_RUN)

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
// built-in titles from the plugin sources, so the model is told what the game already teaches
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

// ── the prompt (files in daily/prompt/) ─────────────────────────────────────
const systemFile = fs.readFileSync(path.join(dailyDir, 'prompt', 'system.md'), 'utf8')
const userFile = fs.readFileSync(path.join(dailyDir, 'prompt', 'user.md.tmpl'), 'utf8')
const examples = existing
  .filter((e) => e.text && e.id)
  .slice(0, 3)
  .map((e) => readJson(path.join('challenges', `${e.id}.json`)))
  .filter(Boolean)
  .map(({ title, area, level, brief, text, solution, expect, why, ft }) => ({ title, area, level, ft, brief, text, solution, expect, why }))
const idsAndTitles = [
  ...existing.filter((e) => e.id).map((e) => ({ id: e.id, title: e.title })),
  ...builtinTitles.map((title) => ({ title })),
].slice(0, 120)

// Levels 4-5 go to the hard model when it differs from the main one: two batches, each with its own prompt.
const focus = focusFor(date)
const hardLevels = focus.levels.filter((l) => l >= 4)
const split = models.hard !== models.main && hardLevels.length > 0 && hardLevels.length < focus.levels.length
const batchSpecs = split
  ? [
      { levels: focus.levels.filter((l) => l < 4), model: models.main, count: Math.max(1, Math.round((wanted * (focus.levels.length - hardLevels.length)) / focus.levels.length)) },
      { levels: hardLevels, model: models.hard, count: Math.max(1, Math.round((wanted * hardLevels.length) / focus.levels.length)) },
    ]
  : [{ levels: focus.levels, model: models.main, count: wanted }]
const batches = batchSpecs.map((b) => ({
  ...b,
  accepted: 0,
  prompt: buildPrompt({ systemFile, userFile, date, focus: { areas: focus.areas, levels: b.levels }, count: b.count, examples, existing: idsAndTitles, extra }),
}))

if (printPrompt) {
  for (const b of batches) {
    log(`=== prompt version ${b.prompt.version}  hash ${b.prompt.hash}  model ${b.model}${b.prompt.extraUsed ? '  (with extra guidance)' : ''}`)
    log('--- system ---')
    log(b.prompt.system)
    log('--- user ---')
    log(b.prompt.user)
  }
  process.exit(0)
}

function output(n) {
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `published=${n}\n`)
}

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

const OVERLOADED = new Set([429, 500, 502, 503, 520, 521, 522, 523, 524, 529]) // 52x: proxy (Cloudflare) timeouts

async function callApi(model, system, messages) {
  const key = env.ANTHROPIC_API_KEY
  const { url, label } = resolveBaseUrl(env.ANTHROPIC_URL)
  log(`asking ${model} at ${label}`)
  let res
  try {
    res = await fetch(`${url}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4096, system, messages }),
      signal: AbortSignal.timeout(Number(env.DAILY_API_TIMEOUT_MS) || 300_000),
    })
  } catch (e) {
    const err = new Error(`could not reach the model API: ${redact(e instanceof Error ? e.message : e, key)}`)
    err.retryable = true
    throw err
  }
  if (!res.ok) {
    const err = new Error(`the model API answered ${res.status}: ${redact((await res.text()).slice(0, 200), key)}`)
    err.retryable = OVERLOADED.has(res.status)
    throw err
  }
  const body = await res.json()
  const text = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  if (!text) throw new Error('the model API sent no text')
  return text
}

/** Returns { text, model }: the model that actually answered (the fallback takes over when the first one is overloaded). */
async function askModel(batch, messages, attempt) {
  if (mock) {
    const file = mock === '1' ? null : mock
    return { text: JSON.stringify(file ? readJson(file) : MOCK_REPLY), model: `${batch.model} (mock)` }
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (use DAILY_MOCK=1 to try the gates without a key)')
  // retries use the fallback model (which is the main one unless ANTHROPIC_MODEL_FALLBACK is set)
  const first = attempt > 0 ? models.fallback : batch.model
  try {
    return { text: await callApi(first, batch.prompt.system, messages), model: first }
  } catch (e) {
    if (!(e instanceof Error) || !e.retryable || models.fallback === first) throw e
    log(`${first} failed (${e.message}); trying ${models.fallback}`)
    return { text: await callApi(models.fallback, batch.prompt.system, messages), model: models.fallback }
  }
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
for (const batch of batches) {
  let messages = [{ role: 'user', content: batch.prompt.user }]
  for (let attempt = 0; attempt <= 2 && batch.accepted < batch.count; attempt += 1) {
    let reply, model
    try {
      ;({ text: reply, model } = await askModel(batch, messages, attempt))
    } catch (e) {
      // a flaky call must not throw away what already passed the gates
      if (!(e instanceof Error) || !e.retryable || accepted.length === 0 && attempt === 0) throw e
      log(`attempt ${attempt + 1}: ${e.message}; keeping the ${accepted.length} that passed`)
      break
    }
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
    const provenance = { model, prompt: `v${batch.prompt.version}:${batch.prompt.hash}` }
    for (const raw of list.slice(0, batch.count * 2)) {
      const s = sanitize(raw, { date, ...provenance })
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
    for (const file of result.ok) {
      if (byFile.has(file)) {
        accepted.push(byFile.get(file))
        batch.accepted += 1
      }
    }
    for (const [file, why] of result.failed) problems.push(`${byFile.get(file)?.title ?? file}: ${why}`)
    fs.rmSync(dir, { recursive: true, force: true })
    log(`attempt ${attempt + 1}: ${result.ok.length} passed, ${problems.length} rejected`)
    for (const p of problems) log(`  rejected  ${p}`)
    if (batch.accepted >= batch.count || attempt === 2 || mock) break
    messages = [
      ...messages,
      { role: 'assistant', content: reply.slice(0, 4000) },
      { role: 'user', content: `${batch.accepted} passed so far. Rejected:\n${problems.join('\n')}\nWrite ${batch.count - batch.accepted} new, different challenges that avoid these problems. Reply with ONLY a JSON array.` },
    ]
  }
}

// ── result ──────────────────────────────────────────────────────────────────
if (accepted.length < MIN_DAY) {
  log(`only ${accepted.length} challenge(s) passed the gates (need ${MIN_DAY}): publishing nothing today`)
  output(0)
  process.exit(0)
}
const chosen = accepted.slice(0, publish)
log(`${dry ? 'dry run: would publish' : 'publishing'} ${chosen.length} challenge(s) for ${date}:`)
for (const c of chosen) log(`  ${c.id}  (${c.area}, level ${c.level})  ${c.title}  [${c.model}, prompt ${c.prompt}]`)
if (!dry) {
  fs.mkdirSync(dailyDir, { recursive: true })
  for (const c of chosen) fs.writeFileSync(path.join(dailyDir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`)
  if (env.DAILY_PR_BODY) {
    const used = [...new Set(chosen.map((c) => c.model))].join(', ')
    const prompts = [...new Set(chosen.map((c) => c.prompt))].join(', ')
    const lines = [
      'Written by a model and checked by the same gates as any contribution: schema, the reference solution replayed in real Neovim, no duplicates. Read the idea and the keys before merging. The run log is in the summary of the workflow run.',
      '',
      `- Model: ${used}`,
      `- Prompt: ${prompts} (files in \`daily/prompt/\`; the number after \`v\` is the file version, then the hash of the rendered prompt)`,
      `- Extra guidance: ${extra ? `yes (${extra.length} characters)` : 'none'}`,
      '',
      '| challenge | level | model | prompt |',
      '| --- | --- | --- | --- |',
      ...chosen.map((c) => `| \`${c.id}\` | ${c.level} | ${c.model} | ${c.prompt} |`),
      '',
    ]
    fs.writeFileSync(env.DAILY_PR_BODY, lines.join('\n'))
  }
}
output(dry ? 0 : chosen.length)
