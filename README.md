# nvim-skill-arcade-challenges

Community challenges for [nvim-skill-arcade](https://github.com/dev-vinicius-andrade/nvim-skill-arcade), plus the
static website where anyone can design and submit one.

* **Submit:** open the site (GitHub Pages of this repo), fill the form, press *Submit as pull request*.
* **Play:** in Neovim run `:ArcadeSync`; the challenges join your runs and practice (marked *community*).
* **Review:** every PR is replayed by CI in a real headless Neovim before a human looks at it.

## How it fits together

```
site/  (form + published list)      challenges/*.json  (one file per challenge, file name = id)
   |  "Submit" -> GitHub new-file URL -> pull request
   v
.github/workflows/validate.yml   schema check + replay every reference solution (PR)
.github/workflows/pages.yml      on main: build _site/community.json + deploy site (Pages)
   v
:ArcadeSync  ->  https://<user>.github.io/nvim-skill-arcade-challenges/community.json
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

```sh
git clone https://github.com/dev-vinicius-andrade/nvim-skill-arcade ../nvim-skill-arcade
ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/validate.lua challenges
ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/build.lua challenges dist/community.json
cd site && python -m http.server    # then open http://localhost:8000 (copy dist/community.json next to index.html)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to write a good challenge.

## One-time setup (maintainer)

1. Create the GitHub repo `dev-vinicius-andrade/nvim-skill-arcade-challenges` and push this folder.
2. Repo *Settings -> Pages -> Source: GitHub Actions*.
3. Push `nvim-skill-arcade` (the workflows check it out) and keep its default branch public.
4. Optional: protect `main` so merges need the *validate challenges* check.
