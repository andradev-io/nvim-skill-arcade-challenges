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

## Reference solution rules

Vim notation (`<Esc>`, `<CR>`, `<C-v>`, `<Space>` ...), max 120 characters. Allowed ex commands: `s g v m t co d y j norm
sort noh tabnew copen cclose cc cn cp vim vimgrep only sp vs b tabclose` (with any range). Not allowed: `:!`, `:lua`,
`:call`, `:e`, `:w`, `|`, `\=`, `<C-r>=`.

## Test it before you open the PR

In Neovim, play the draft: press *Copy command* in the site's *Join in Neovim* box and paste `:ArcadeJoin ARC1.…` (nothing is saved).
The page's *Try it here* box gives a quick approximate check without leaving the browser.

To run the same replay CI does:

```sh
ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/validate.lua challenges
```
