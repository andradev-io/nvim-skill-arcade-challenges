// Arcade phase generator: asks a model for new game levels, sanitizes and validates them, then appends valid levels to
// the TypeScript source files and campaign stages. Mirrors generate-daily.mjs but targets arcade games instead of daily
// challenges.
//
//   ANTHROPIC_API_KEY         secret, sent only as the x-api-key header
//   ANTHROPIC_URL             base URL (a proxy or gateway); default https://api.anthropic.com
//   ANTHROPIC_MODEL           the generator model (default claude-sonnet-5-5)
//   DAILY_MODEL               one-run override of the model
//   DAILY_BATCH_BUDGET_SECONDS total time budget per game batch (default 300)
//   ARCADE_GAME               target game(s): maze, rhythm, defender, snake, memory, or all (default: all)
//   ARCADE_TIER               difficulty 1-5 (default: auto-rotate based on date)
//   ARCADE_COUNT              levels per game (default: 2)
//   ARCADE_THEME              creative direction (max 160 chars)
//   ARCADE_DRY_RUN            if truthy, run gates but write nothing
//   ARCADE_MOCK=1             no network: use built-in mock data
//   ARCADE_PR_BODY            path to write PR description
//
//   node scripts/generate-arcade-phases.mjs --print-prompt    render the final prompt and exit
import fs from 'node:fs'
import path from 'node:path'
import {
  sanitizeMazeLevel, sanitizeRhythmLevel, sanitizeDefenderWave, sanitizeSnakeLevel, sanitizeMemoryLevel,
  validateMazePlayability, validateRhythmPlayability, validateDefenderPlayability, validateSnakePlayability, validateMemoryPlayability,
  serializeToTypeScript, appendLevelToSource,
  generateCampaignStage, appendStageToCampaign,
  resolveBaseUrl, redact, extractJson, resolveModels, modelChain, resolveBudgetMs, resolveTimeoutMs,
  capExtra, parsePromptFile, render, readUsage, addUsage, usageLines,
} from './arcade-lib.mjs'

// Arcade-level de-duplication: only id and name matter (no text/expect signature like daily challenges).
function arcadeKnownSet(existing) {
  const ids = new Set()
  const names = new Set()
  for (const e of existing) {
    if (e.id) ids.add(e.id.toLowerCase())
    if (e.name) names.add(e.name.toLowerCase())
  }
  return { ids, names }
}

function arcadeDuplicateOf(level, known) {
  if (known.ids.has(String(level.id ?? '').toLowerCase())) return 'same id'
  if (known.names.has(String(level.name ?? '').toLowerCase())) return 'same name'
  return null
}

function arcadeRemember(level, known) {
  if (level.id) known.ids.add(level.id.toLowerCase())
  if (level.name) known.names.add(level.name.toLowerCase())
}

const env = process.env
const log = (msg) => console.log(msg)
const flag = (v) => /^(1|true|yes)$/i.test(String(v ?? ''))
const printPrompt = process.argv.includes('--print-prompt')

const GAMES = ['maze', 'rhythm', 'defender', 'snake', 'memory']
const pickGames = (() => {
  const raw = String(env.ARCADE_GAME ?? 'all').trim().toLowerCase()
  if (raw === 'all') return GAMES
  const list = raw.split(',').map((g) => g.trim()).filter((g) => GAMES.includes(g))
  return list.length ? [...new Set(list)] : GAMES
})()

const date = new Date().toISOString().slice(0, 10)
const dayIndex = Math.floor(Date.now() / 86_400_000)
const pickTier = (() => {
  const raw = Number(env.ARCADE_TIER)
  if (Number.isInteger(raw) && raw >= 1 && raw <= 5) return raw
  return 1 + (dayIndex % 5) // auto-rotate 1-5 by date
})()

const count = Math.min(10, Math.max(1, Number(env.ARCADE_COUNT) || 2))
const theme = capExtra(env.ARCADE_THEME).slice(0, 160).replace(/\s+/g, ' ') || 'varied Vim practice scenarios'
const dry = flag(env.ARCADE_DRY_RUN)
const mock = env.ARCADE_MOCK === '1'
const models = resolveModels(env)

// ── existing levels ─────────────────────────────────────────────────────────
function readExistingLevels(game) {
  const file = game === 'defender'
    ? path.join('src', 'games', game, 'waves.ts')
    : path.join('src', 'games', game, 'levels.ts')
  if (!fs.existsSync(file)) return []
  const src = fs.readFileSync(file, 'utf8')
  const results = []
  // Match id: '...' or id: "..." patterns in the exported array entries
  const idRe = /id:\s*['"]([^'"]+)['"]/g
  const nameRe = /name:\s*['"]([^'"]+)['"]/g
  const ids = [...src.matchAll(idRe)].map((m) => m[1])
  const names = [...src.matchAll(nameRe)].map((m) => m[1])
  for (let i = 0; i < Math.min(ids.length, names.length); i++) {
    results.push({ id: ids[i], name: names[i] })
  }
  return results
}

function readCampaignStats() {
  const file = path.join('src', 'store', 'campaignStages.ts')
  if (!fs.existsSync(file)) return { latestChapter: 0, totalStages: 0 }
  const src = fs.readFileSync(file, 'utf8')
  const chapters = [...src.matchAll(/chapter:\s*(\d+)/g)].map((m) => Number(m[1]))
  const stages = [...src.matchAll(/id:\s*['"][^'"]+['"]/g)]
  return {
    latestChapter: chapters.length ? Math.max(...chapters) : 0,
    totalStages: stages.length,
  }
}

// ── the prompt ──────────────────────────────────────────────────────────────
const systemFile = fs.readFileSync(path.join('arcade', 'prompt', 'system.md'), 'utf8')
const userFile = fs.readFileSync(path.join('arcade', 'prompt', 'user.md.tmpl'), 'utf8')
const sys = parsePromptFile(systemFile)
const usr = parsePromptFile(userFile)

function buildGamePrompt(game, tier, existing, examples, nextIdPrefix, campaignStats) {
  const vars = {
    count,
    game,
    tier,
    theme,
    existing_levels: JSON.stringify(existing),
    latest_chapter: campaignStats.latestChapter,
    total_stages: campaignStats.totalStages,
    next_id_prefix: nextIdPrefix,
    examples: JSON.stringify(examples),
  }
  const system = render(sys.body, vars).trim()
  const user = render(usr.body, vars).trim()
  return { system, user, version: `${sys.version}.${usr.version}` }
}

// ── mock data ───────────────────────────────────────────────────────────────
const MOCK_LEVELS = {
  maze: [{
    id: 'maze-gen-mock-1',
    name: 'Mock Maze',
    width: 8,
    height: 6,
    grid: [
      ['start', 'open', 'open', 'collectible', 'open', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'collectible', 'open', 'open', 'wall'],
      ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
    ],
    doors: [],
    markers: {},
    parSeconds: 30,
    parMotions: 4,
    hints: ['Use hjkl to navigate.'],
  }],
  rhythm: [{
    id: 'rhythm-gen-mock-1',
    name: 'Mock Rhythm',
    bpm: 90,
    durationMs: 30000,
    laneCount: 4,
    laneKeys: ['h', 'j', 'k', 'l'],
    notes: Array.from({ length: 20 }, (_, i) => ({ lane: i % 4, timeMs: 1000 + i * 1000 })),
    difficulty: 'basic',
  }],
  defender: [{
    id: 'defender-gen-mock-1',
    name: 'Mock Defense',
    wave: 1,
    commands: ['h', 'j', 'k', 'l', 'w', 'b'],
    enemyCount: 6,
    spawnIntervalMs: 2500,
    baseSpeed: 30,
    speedVariance: 10,
  }],
  snake: [{
    id: 'snake-gen-mock-1',
    name: 'Mock Snake',
    width: 10,
    height: 8,
    walls: [],
    initialFood: [
      { position: { row: 2, col: 3 }, label: 'dd', tip: 'Deletes the current line', points: 10 },
      { position: { row: 4, col: 6 }, label: 'yy', tip: 'Yanks the current line', points: 10 },
    ],
    spawnRate: 5000,
    baseSpeed: 300,
    speedIncreasePerFood: 10,
    parFoods: 2,
    parTime: 60,
    hints: ['Use hjkl to move.'],
    allowWordMotions: false,
  }],
  memory: [{
    id: 'memory-gen-mock-1',
    name: 'Mock Memory',
    pairs: [
      { id: 'p1', command: 'h', description: 'Move cursor left', category: 'motion' },
      { id: 'p2', command: 'j', description: 'Move cursor down', category: 'motion' },
      { id: 'p3', command: 'k', description: 'Move cursor up', category: 'motion' },
      { id: 'p4', command: 'l', description: 'Move cursor right', category: 'motion' },
      { id: 'p5', command: 'w', description: 'Jump to next word start', category: 'motion' },
      { id: 'p6', command: 'b', description: 'Jump to previous word start', category: 'motion' },
    ],
    gridCols: 4,
    gridRows: 3,
    parTime: 30,
    parMoves: 12,
    hints: ['Match each command with its description.'],
  }],
}

const SANITIZERS = {
  maze: sanitizeMazeLevel,
  rhythm: sanitizeRhythmLevel,
  defender: sanitizeDefenderWave,
  snake: sanitizeSnakeLevel,
  memory: sanitizeMemoryLevel,
}

const VALIDATORS = {
  maze: validateMazePlayability,
  rhythm: validateRhythmPlayability,
  defender: validateDefenderPlayability,
  snake: validateSnakePlayability,
  memory: validateMemoryPlayability,
}

// ── API call ────────────────────────────────────────────────────────────────
const OVERLOADED = new Set([429, 500, 502, 503, 520, 521, 522, 523, 524, 529])
const usageTotals = new Map()

async function callApi(model, system, messages, timeoutMs) {
  const key = env.ANTHROPIC_API_KEY
  const { url, label } = resolveBaseUrl(env.ANTHROPIC_URL)
  log(`asking ${model} at ${label}`)
  let res
  try {
    res = await fetch(`${url}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 8192, system, messages }),
      signal: AbortSignal.timeout(timeoutMs),
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
  addUsage(usageTotals, model, readUsage(body))
  const text = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  if (!text) throw new Error('the model API sent no text')
  return text
}

async function askModel(prompt, attempt, deadline) {
  if (mock) return { text: null, model: 'mock', mock: true }
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (use ARCADE_MOCK=1 to try without a key)')
  const chain = modelChain(models.main, models)
  const order = [...chain.slice(attempt % chain.length), ...chain.slice(0, attempt % chain.length)]
  const per = resolveTimeoutMs(env)
  let last = new Error('no time left in the batch budget')
  const messages = [{ role: 'user', content: prompt.user }]
  for (const m of order) {
    const left = deadline - Date.now()
    if (left < 5_000) break
    try {
      return { text: await callApi(m, prompt.system, messages, Math.min(per, left)), model: m }
    } catch (e) {
      last = e
      const more = order.indexOf(m) < order.length - 1
      log(`${m} failed (${(e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 120)})${more ? '; trying next' : ''}`)
    }
  }
  throw last
}

// ── main loop ───────────────────────────────────────────────────────────────
if (printPrompt) {
  for (const game of pickGames) {
    const existing = readExistingLevels(game)
    const campaignStats = readCampaignStats()
    const nextIdPrefix = `${game}-gen-${existing.length + 1}`
    const prompt = buildGamePrompt(game, pickTier, existing, MOCK_LEVELS[game].slice(0, 1), nextIdPrefix, campaignStats)
    log(`=== ${game} tier ${pickTier}  prompt v${prompt.version}`)
    log('--- system ---')
    log(prompt.system)
    log('--- user ---')
    log(prompt.user)
  }
  process.exit(0)
}

function output(n) {
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `published=${n}\n`)
}

const accepted = [] // { game, level, model, promptVersion }

for (const game of pickGames) {
  const existing = readExistingLevels(game)
  const campaignStats = readCampaignStats()
  const nextIdPrefix = `${game}-gen-${existing.length + 1}`
  const prompt = buildGamePrompt(game, pickTier, existing, MOCK_LEVELS[game].slice(0, 1), nextIdPrefix, campaignStats)
  const known = arcadeKnownSet(existing)
  const deadline = Date.now() + resolveBudgetMs(env)
  let gameAccepted = 0

  log(`\n=== ${game} (tier ${pickTier}, want ${count}) ===`)
  log(`prompt v${prompt.version}: ~${Math.round((prompt.system.length + prompt.user.length) / 4)} input tokens`)

  for (let attempt = 0; gameAccepted < count && (attempt < 6 || mock) && Date.now() < deadline; attempt++) {
    let reply, model
    try {
      ;({ text: reply, model } = await askModel(prompt, attempt, deadline))
    } catch (e) {
      log(`attempt ${attempt + 1}: ${e instanceof Error ? e.message.split('\n')[0] : e}; keeping ${gameAccepted} accepted`)
      break
    }

    let list
    if (mock) {
      list = MOCK_LEVELS[game]
      model = 'mock'
    } else {
      try {
        list = extractJson(reply)
      } catch (e) {
        log(`attempt ${attempt + 1}: ${e instanceof Error ? e.message : e}`)
        continue
      }
    }

    const problems = []
    const sanitizer = SANITIZERS[game]
    const validator = VALIDATORS[game]

    for (const raw of list.slice(0, count * 2)) {
      const result = sanitizer(raw, { game, tier: pickTier, model, promptVersion: prompt.version })
      if (!result.level) {
        problems.push(`${raw?.id ?? raw?.name ?? '?'}: ${result.error}`)
        continue
      }
      const dup = arcadeDuplicateOf(result.level, known)
      if (dup) {
        problems.push(`${result.level.id}: duplicate (${dup})`)
        continue
      }
      const playErrors = validator(result.level)
      if (Array.isArray(playErrors) && playErrors.length > 0) {
        problems.push(`${result.level.id ?? result.level.wave ?? '?'}: ${playErrors.join('; ')}`)
        continue
      }
      arcadeRemember(result.level, known)
      accepted.push({ game, level: result.level, model, promptVersion: prompt.version })
      gameAccepted++
    }

    log(`attempt ${attempt + 1}: ${gameAccepted} accepted, ${problems.length} rejected`)
    for (const p of problems) log(`  rejected  ${p}`)
    if (gameAccepted >= count || mock) break
  }
}

// ── write results ───────────────────────────────────────────────────────────
const usage = usageLines(usageTotals)
if (usage.length) {
  log('\ntoken usage:')
  for (const l of usage) log(l)
}

if (!accepted.length) {
  log('\nno levels passed the gates: publishing nothing')
  output(0)
  process.exit(0)
}

log(`\n${dry ? 'dry run: would publish' : 'publishing'} ${accepted.length} level(s):`)
for (const a of accepted) {
 const lid = a.level.id ?? `wave-${a.level.wave}`
 const lname = a.level.name ?? `Wave ${a.level.wave}`
 log(`  ${a.game}/${lid}  ${lname}  [${a.model}, prompt ${a.promptVersion}]`)
}

if (!dry) {
  // Append levels to source files
  const byGame = new Map()
  for (const a of accepted) {
    if (!byGame.has(a.game)) byGame.set(a.game, [])
    byGame.get(a.game).push(a.level)
  }
  for (const [game, levels] of byGame) {
    const tsCode = serializeToTypeScript(game, levels)
    appendLevelToSource(game, tsCode)
    log(`  appended ${levels.length} level(s) to src/games/${game}/${game === 'defender' ? 'waves' : 'levels'}.ts`)
  }

  // Generate and append campaign stages
  for (const a of accepted) {
    const stage = generateCampaignStage(a.game, a.level, campaignStatsFor(a.game))
    appendStageToCampaign(stage)
  }
  log(`  appended ${accepted.length} campaign stage(s) to src/store/campaignStages.ts`)

  // PR body
  if (env.ARCADE_PR_BODY) {
    const usedModels = [...new Set(accepted.map((a) => a.model))].join(', ')
    const promptVersions = [...new Set(accepted.map((a) => a.promptVersion))].join(', ')
    const gamesList = [...new Set(accepted.map((a) => a.game))].join(', ')
    const lines = [
      'Generated arcade levels checked by schema validation and playability gates.',
      '',
      `- Model: ${usedModels}`,
      `- Prompt: v${promptVersions} (files in \`arcade/prompt/\`)`,
      `- Games: ${gamesList}`,
      `- Levels: ${accepted.length}`,
      `- Tier: ${pickTier}`,
      `- Theme: ${theme}`,
      '',
      '| game | level id | name | model |',
      '| --- | --- | --- | --- |',
      ...accepted.map((a) => `| ${a.game} | \`${a.level.id}\` | ${a.level.name} | ${a.model} |`),
      '',
      ...(usage.length ? ['Tokens spent:', '', ...usage, ''] : []),
    ]
    fs.writeFileSync(env.ARCADE_PR_BODY, lines.join('\n'))
  }
}

output(dry ? 0 : accepted.length)

// ── helpers ─────────────────────────────────────────────────────────────────
function campaignStatsFor(game) {
  const stats = readCampaignStats()
  // Count existing stages for this game to determine level index
  const file = path.join('src', 'store', 'campaignStages.ts')
  if (!fs.existsSync(file)) return { ...stats, levelIndex: 0 }
  const src = fs.readFileSync(file, 'utf8')
  const gameStages = [...src.matchAll(new RegExp(`gameId:\\s*['"]${game}['"]`, 'g'))]
  return { ...stats, levelIndex: gameStages.length }
}