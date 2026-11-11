# Writing a good challenge

The game judges the **end state**, so the best challenges have one clear goal and many valid routes.

## Checklist

1. **One idea per challenge.** "Change what is inside the quotes", not "refactor this function".
2. **The brief states the goal, never the keys.** Good: *Replace the text inside the quotes with: new*.
   Bad: *Use ci" to ...*.
3. **Reachable with plain Neovim.** Plugin tips go in `helps`; set `plugin_par` to the key count a plugin needs, and
   `needs` only if the challenge is meaningless without that plugin group.
4. **Not solved at the start.** CI rejects challenges whose start state already satisfies `expect`.
5. **The reference solution is the shortest sensible route.** Its key count becomes the par (S rank).
6. **`why` teaches.** One or two sentences shown after the round: the idea, and a nearby trick.
7. **Pick the level honestly**: 1 = single motion/operator, 2 = combination, 3 = needs a trick (blocks, registers),
   4 = multi-step, 5 = expert (regex captures, macros with counts).

## Fields

See `schema/challenge.schema.json`. Required: `id title area level brief text solution expect why`.
`id` must equal the file name (`challenges/<id>.json`).

`expect` (at least one; all given assertions must hold, mode must be normal):

| key | meaning |
|---|---|
| `text` | whole buffer equals this (trailing spaces / blank lines ignored; `loose` also ignores leading spaces) |
| `cursor` | `[row]` or `[row, col]` (row 1-based, col 0-based), in the challenge buffer |
| `at` | `[row, "needle", "first"\|"last"]` - cursor on that text (computed for you) |
| `marks` | `{ "a": 3 }` mark a is on line 3 |
| `windows`, `layout` | window count in the tab, `row` (side by side) or `col` (stacked) |
| `extra_tabs` | number of newly opened tab pages (and you are not in the arena tab) |
| `quickfix` | `{ idx, size, all_contain }` |
| `float_text` | some floating window contains this text |
| `alt_buffer` | you ended in the other buffer (use with `preset: "alt_buffer"`) |

`preset` prepares the arena: `diagnostics` (warnings "ARC: ..." on `preset_rows`), `splits` (3 windows),
`alt_buffer` (you start in a second buffer), `quickfix_hits` (quickfix filled from `preset_rows`).

## Tracks (`area: "track"`)

The buffer is a text-grid map and the task is to reach a goal cell, optionally touching ordered checkpoints and with
whole key families switched off. Only the end state is judged, so players' own keybinds and plugins work.

```json
{ "area": "track", "text": "S...X\n.....", "cursor": [1, 0],
  "track": { "goal": [1, 4], "checkpoints": [[2, 2]], "forbid": ["hjkl", "arrows"] }, "solution": "j2lgg$" }
```

| key | meaning |
|---|---|
| `track.goal` | `[row, col]` (row 1-based, col 0-based) the cursor must end on |
| `track.checkpoints` | up to 6 cells, touched in this order; distinct, never the goal |
| `track.forbid` | any of `hjkl`, `arrows`, `mouse` (buffer-local, only on this map) |

`expect` is derived (cursor on the goal, map unchanged) and can be left out. The map must be ASCII and the cursor
start may equal the goal only when there are checkpoints. In the site's form, the *Track* section has a clickable map
to place start, goal and checkpoints. The reference `solution` is replayed in CI and must visit every checkpoint in order.

## Reference solution rules

Vim notation (`<Esc>`, `<CR>`, `<C-v>`, `<Space>` ...), max 120 characters. Allowed ex commands: `s g v m t co d y j norm
sort noh tabnew copen cclose cc cn cp vim vimgrep only sp vs b tabclose` (with any range). Not allowed: `:!`, `:lua`,
`:call`, `:e`, `:w`, `|`, `\=`, `<C-r>=`.

## Test it before you open the PR

In Neovim, play the draft: press *Copy command* in the site's *Join in Neovim* box and paste `:ArcadeJoin ARC1.…` (nothing is saved).
The page's *Play it* panel lets you try the draft with stock Vim keys right in the browser.

To run the same replay CI does:

```sh
ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/validate.lua challenges
```

## Refactor sprints (`area: "refactor"`)

A micro refactor, 10-40 seconds, judged by the end state: `expect.text` is the refactored code. Set `ft` to the
language of the snippet (`lua`, `typescript`, `javascript`, `go`, `cs`, `python`) so it is highlighted. Keep the snippet
to a few lines, state the goal in the brief ("Swap the two arguments", "Invert the condition"), and prefer a result that
has one correct shape (use `loose` when only the indentation may differ). Refactors that need a language server (rename
symbol, code actions) cannot be judged here: give them a plain-text route, with the LSP route in `helps`.

## Daily challenges (maintainer)

A scheduled workflow (`.github/workflows/daily.yml`, 04:17 UTC) asks a model for 8 new challenges and keeps 3 of them
(native Vim only, areas without a game-made setup). A candidate survives only if it passes the same gates as a pull
request: the plugin's schema (no shell, no expressions, no chaining, no file commands), the reference solution replayed in
real headless Neovim, and de-duplication against the built-ins, the community and earlier daily files. Rejected ones are
sent back to the model with the exact reason (two retries). Fewer than 3 survivors means nothing is published that day.
The survivors arrive as a pull request that adds `daily/<id>.json` (with `date` and `generated: true`); once merged they
join `community.json` in a separate `ai` collection (`scripts/build.lua` puts every `generated` challenge there; `challenges/`
stays the human collection). The plugin lists them with `:ArcadeAI` and keeps them out of normal runs unless `ai.in_runs` is set;
the site shows them on the *AI challenges* page and `stats.json` gets an `ai` count. The plugin's daily mode plays the ones dated
today (the built-in daily set is the fallback).

The model's text is only ever data: fields are whitelisted one by one, ids and the date are set by the script, and the
keys run in a Neovim child process that is given no secrets. The API key is read from one environment variable in one step
and is never printed; a private gateway host is masked in the log.

Set it up (the values are yours to set; they never go in the repository):

```sh
gh secret set ANTHROPIC_API_KEY -R dev-vinicius-andrade/nvim-skill-arcade-challenges
gh variable set ANTHROPIC_URL --body https://your-gateway.example.com -R dev-vinicius-andrade/nvim-skill-arcade-challenges   # optional
gh variable set ANTHROPIC_MODEL --body claude-sonnet-5-5 -R dev-vinicius-andrade/nvim-skill-arcade-challenges               # optional
gh variable set ANTHROPIC_MODEL_HARD --body <model-id> -R dev-vinicius-andrade/nvim-skill-arcade-challenges                 # optional, levels 4-5
gh variable set ANTHROPIC_MODEL_FALLBACK --body <model-id> -R dev-vinicius-andrade/nvim-skill-arcade-challenges             # optional
gh variable set DAILY_ENABLED --body true -R dev-vinicius-andrade/nvim-skill-arcade-challenges
```

- `ANTHROPIC_MODEL` is the generator (default `claude-sonnet-5-5`). Optional: `ANTHROPIC_MODEL_FALLBACK` (used on retries and when
  the API is overloaded; default the same model) and `ANTHROPIC_MODEL_HARD` (levels 4-5, which then get their own batch;
  default the same model). A manual run can override all three with the `model` input. Ids are only checked for charset
  and length, so new models work without a code change. Each challenge records the model that wrote it (`model`) and the
  prompt (`prompt`: file version and hash) in `daily/<id>.json`, and the pull request lists both.
- `ANTHROPIC_URL` is a base URL (a proxy or gateway); unset or empty means `https://api.anthropic.com`. It must be https
  (http only for `localhost`) and cannot contain credentials or a query.
- **Kill switch:** `gh variable set DAILY_ENABLED --body false` (or delete it). Nothing runs unless it is exactly `true`.
- **Dry run:** *Actions -> daily challenges -> Run workflow* with `dry_run` on (the default for manual runs) runs every gate
  and prints the result in the run summary without opening a pull request.
- **Budget:** one run is about 8k tokens in and 4k out, cents per day. Keep a spend alert of about $5 a month on the provider
  side.
- Pull requests opened with the built-in token do not start other workflows: run *validate challenges* by hand, or give the
  workflow a token that can. The generator has already replayed every file with the same engine.

### The prompt

The prompt is two versioned files, changed by pull request (the same gates still judge every challenge it produces):
`daily/prompt/system.md` (role, field rules, key notation, hard rules, quality) and `daily/prompt/user.md.tmpl` (the daily
request). The first line `<!-- version: N -->` is the file version: bump it when you change the file. Placeholders, filled
in one pass: `{{schema}}`, `{{examples}}`, `{{existing_ids}}`, `{{area}}`, `{{level}}`, `{{languages}}`, `{{count}}`, `{{date}}`; an
unknown one fails the *validate challenges* check. For a light touch without editing files, set the repository variable
`DAILY_PROMPT_EXTRA` (appended, 1000 characters at most) or the `prompt_extra` input of a manual run.

```sh
gh variable set DAILY_PROMPT_EXTRA --body "Prefer small realistic code snippets." -R dev-vinicius-andrade/nvim-skill-arcade-challenges
ARCADE_PLUGIN=../nvim-skill-arcade node scripts/generate-daily.mjs --print-prompt   # the final prompt, no key needed
```

Try the gates locally without any key (a built-in fake reply with good, unsafe, wrong, duplicate and already-solved
candidates):

```sh
DAILY_MOCK=1 DAILY_DRY_RUN=true ARCADE_PLUGIN=../nvim-skill-arcade node scripts/generate-daily.mjs
```
