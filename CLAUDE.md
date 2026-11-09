# nvim-skill-arcade-challenges

Community challenges for [nvim-skill-arcade](https://github.com/dev-vinicius-andrade/nvim-skill-arcade) plus the website
where anyone designs, plays and submits one.

Stack: Vite 8 · React 19 · TypeScript 6 strict · MUI 9 + Emotion · zustand 5 · CodeMirror 6 + `@replit/codemirror-vim` ·
Vitest. Lua (Neovim headless) for CI validation and the bundle build.

## Commands
- `npm run dev` — dev server (http://localhost:5173)
- `npm run build` — typecheck + production build into `dist/`
- `npm run typecheck` · `npm run lint` · `npm test`
- `ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/validate.lua challenges` — schema check + replay
  every reference solution in real Neovim (the authority)
- `ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/build.lua challenges dist/community.json` — the
  bundle `:ArcadeSync` downloads

## Conventions
- `src/core` is framework-free TypeScript (no React imports): schema checks, end-state compare, approximate replay,
  room codes. It mirrors `lua/skill_arcade/schema.lua` and `catalog.lines_equal` in the plugin; when the plugin changes,
  change it here too. The CI replay in real Neovim stays the authority; the browser replay is only a preview.
- MUI for components and theme. Colors come from the theme (`theme.palette.*` / `--mui-palette-*`); no hard-coded hex in
  components. MUI 9 `Stack` takes layout via `sx`, not system props.
- Components stay under ~150 lines; stateful logic goes into hooks (`src/hooks`) or zustand (`src/store`). No `any`.
- Browser storage is always in try/catch; the page works when localStorage is blocked.
- A challenge is **data only** (`challenges/<id>.json`, file name = id). Never add a field that can hold code.
- Update `filemap.md` when adding or moving files.
