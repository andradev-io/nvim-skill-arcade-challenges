# nvim-skill-arcade-challenges

Community challenges for [nvim-skill-arcade](https://github.com/dev-vinicius-andrade/nvim-skill-arcade), plus the
static website where anyone can design and submit one.

* **Submit:** open the site (GitHub Pages of this repo), fill the form, press *Submit as pull request*.
* **Play while you write:** the *Play it* panel is a real Vim-keys editor (CodeMirror 6 + `@replit/codemirror-vim`,
  bundled by Vite, no CDN) preloaded with your start buffer and cursor. It updates as you edit the form, counts
  keys against par, times you, and runs the same end-state check as the game (buffer text and cursor, normal mode).
  It is stock Vim emulation, not your Neovim: your keybinds and plugins are not active, and plugin-specific
  challenges and non-text assertions (windows, quickfix ...) are flagged as "only in Neovim".
* **Terminal (your own keymaps):** the *Terminal* tab is a free, unscored sandbox. Give it a GitHub user, `user/repo`
  or a link to a file and it reads your Neovim config straight from GitHub (public repos, no token, nothing
  executed), keeps plain `vim.keymap.set` / `nvim_set_keymap` / `nmap` mappings and applies them to the browser
  editor. Lua-function mappings, plugin mappings and `:Commands` the browser lacks are skipped and listed with the
  reason. Mappings stay in your browser and never count in the Play tab.
* **Tracks:** pick the skill area `track` to draw a text-grid map; a clickable editor places start, goal and ordered
  checkpoints, and key rules (no hjkl / arrows / mouse) can be switched off. *Play it* enforces them and shows
  checkpoint progress. See CONTRIBUTING.md.
* **Replay check:** *Check the reference keys* replays your solution with a small approximate interpreter, and
  *Join in Neovim* gives your draft a room code and the command `:ArcadeJoin ARC1.…` to play it for real with your own
  keybinds and plugins. No upload, nothing is saved.
* **Play:** in Neovim run `:ArcadeSync`; the challenges join your runs and practice (marked *community*).
* **Review:** every PR is replayed by CI in a real headless Neovim before a human looks at it.

## How it fits together

```
src/  (React site: form, play, list)  challenges/*.json  (one file per challenge, file name = id)
   |  "Submit" -> GitHub new-file URL -> pull request
   v
.github/workflows/validate.yml   schema check + replay every reference solution (PR)
.github/workflows/pages.yml      on main: tests + site build + dist/community.json, deploy (Pages)
   v
:ArcadeSync  ->  <site url>/community.json   (GitHub Pages, or the custom domain once set)
```

The engine that judges a challenge is the plugin itself (`skill_arcade.validate`), checked out by CI, so the
website, CI and the game can never disagree about what a valid challenge is.

## Safety model

* A challenge is **data only**. The schema is a whitelist: unknown fields are dropped, and there is no field that can
  hold code. Checks and set-ups come from fixed presets inside the plugin.
* Reference solutions are replayed on CI machines and by maintainers, so they are restricted: no `:!`, `:lua`, `|`,
  `\=`, `<C-r>=`, and only a short list of ex commands (`:s :g :v :m :t :d :y :j :norm :sort :copen :cc :vimgrep
  :split :only :tabnew ...`).
* The plugin **re-validates everything** it downloads and again on every load, so a tampered local file is ignored.
* `:ArcadeSync` is manual and https-only. Nothing is fetched in the background.

## Local use

Site (Node 22):

```sh
npm ci
npm run dev        # http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```

Challenges (needs Neovim and the plugin checked out next to this repo):

```sh
git clone https://github.com/dev-vinicius-andrade/nvim-skill-arcade ../nvim-skill-arcade
ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/validate.lua challenges
ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/build.lua challenges public/community.json
```

The second `build.lua` line writes the bundle into `public/` so `npm run dev` shows the published list (git-ignored).

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to write a good challenge.

## One-time setup (maintainer)

1. Create the GitHub repo `dev-vinicius-andrade/nvim-skill-arcade-challenges` and push this folder.
2. Repo *Settings -> Pages -> Source: GitHub Actions*.
3. Push `nvim-skill-arcade` (the workflows check it out) and keep its default branch public.
4. Optional: protect `main` so merges need the *validate challenges* check.
