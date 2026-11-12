/** Which Neovim plugins the browser Vim can imitate, and which it cannot (and why). */

export type PluginStatus = 'supported' | 'partial' | 'unsupported'

export interface PluginInfo {
  /** Shim id; plugins sharing a shim share an id. Unsupported ones have no shim. */
  id: string
  name: string
  /** GitHub repos (owner/name, lowercase) that provide it. Matched against the user's plugin specs. */
  repos: string[]
  status: PluginStatus
  /** What works, or why it cannot. */
  note: string
  /** The keys it brings, for the list. */
  keys?: string
}

export const PLUGINS: PluginInfo[] = [
  {
    id: 'comment',
    name: 'Comment',
    repos: ['numtostr/comment.nvim', 'echasnovski/mini.comment', 'tpope/vim-commentary', 'terrortylor/nvim-comment', 'preservim/nerdcommenter'],
    status: 'supported',
    note: 'Line comments by filetype: toggle with gcc, an operator or a visual selection, open a comment line with gco / gcO. No block comments. Neovim 0.10+ has gc built in, so this stays on.',
    keys: 'gcc  gc{motion}  gc (visual)  gco  gcO',
  },
  {
    id: 'surround',
    name: 'Surround',
    repos: ['kylechui/nvim-surround', 'tpope/vim-surround', 'echasnovski/mini.surround', 'machakann/vim-sandwich'],
    status: 'supported',
    note: 'Add, delete and change pairs of ( [ { < and quotes. Tags (t) and functions (f) are not simulated.',
    keys: 'ys{motion}{char}  yss{char}  ds{char}  cs{old}{new}  S{char} (visual)',
  },
  {
    id: 'autopairs',
    name: 'Auto pairs',
    repos: ['windwp/nvim-autopairs', 'echasnovski/mini.pairs', 'jiangmiao/auto-pairs', 'raimondi/delimitmate', 'altermo/ultimate-autopair.nvim'],
    status: 'supported',
    note: 'Typing ( [ { or a quote adds the closing one; typing the closer steps over it; Backspace removes an empty pair.',
    keys: 'insert mode',
  },
  {
    id: 'textobjects',
    name: 'Text objects',
    repos: ['echasnovski/mini.ai', 'wellle/targets.vim', 'nvim-treesitter/nvim-treesitter-textobjects', 'chrisgrieser/nvim-various-textobjs'],
    status: 'partial',
    note: 'Arguments (ia / aa), any quote (iq / aq) and calls (if / af), found by brackets, not by a syntax tree. Class and function-body objects are not simulated.',
    keys: 'ia aa  iq aq  if af',
  },
  { id: 'telescope', name: 'Telescope / fzf', repos: ['nvim-telescope/telescope.nvim', 'ibhagwan/fzf-lua', 'junegunn/fzf.vim'], status: 'partial', note: 'Picker UI simulation: :Telescope find_files, live_grep or buffers opens a fuzzy picker over challenge-provided items. Selection jumps the cursor to the chosen entry.', keys: ':Telescope' },
  { id: 'tree', name: 'File explorers', repos: ['nvim-tree/nvim-tree.lua', 'nvim-neo-tree/neo-tree.nvim', 'stevearc/oil.nvim', 'echasnovski/mini.files'], status: 'unsupported', note: 'There are no files here, only buffers.' },
  { id: 'lsp', name: 'LSP, completion and formatting', repos: ['neovim/nvim-lspconfig', 'hrsh7th/nvim-cmp', 'saghen/blink.cmp', 'stevearc/conform.nvim', 'williamboman/mason.nvim', 'mfussenegger/nvim-lint'], status: 'partial', note: 'Scripted hover (K), go-to-definition (gd) and diagnostic navigation (]d / [d) from challenge data. Completion and formatting are not simulated.', keys: 'K gd ]d [d' },
  { id: 'git', name: 'Git', repos: ['kdheepak/lazygit.nvim', 'tpope/vim-fugitive', 'lewis6991/gitsigns.nvim', 'sindrets/diffview.nvim', 'nvim-telescope/telescope-advanced-git-search.nvim'], status: 'unsupported', note: 'There is no repository here.' },
  { id: 'treesitter', name: 'Treesitter', repos: ['nvim-treesitter/nvim-treesitter'], status: 'partial', note: 'Structural text objects via pre-computed ranges: function, class, statement, parameter, block and tag. Ranges are provided in challenge data; no live parsing.', keys: 'if af ic ac is as ip ap ib ab it at' },
  { id: 'motion', name: 'Jump motions', repos: ['folke/flash.nvim', 'smoka7/hop.nvim', 'ggandor/leap.nvim', 'easymotion/vim-easymotion'], status: 'partial', note: 'Label-based jumping with "s" trigger when jump_targets are provided. Labels appear over word starts; type the label to jump. Only active when motion plugin is enabled and targets exist.', keys: 's (jump mode)' },
{ id: 'bookmarks', name: 'Harpoon / named marks', repos: ['theprimeagen/harpoon', 'stevearc/aerial.nvim'], status: 'partial', note: 'Slot-based buffer navigation: save buffers to named slots (a-d) and jump between them. Uses :archoon add/jump ex commands for replay simulation.', keys: ':archoon add {a-d}  :archoon jump {a-d}' },
  {
    id: 'whichkey',
    name: 'Which-key',
    repos: ['folke/which-key.nvim'],
    status: 'supported',
    note: 'Prefix hint overlay: after typing a leader or prefix key, available bindings appear in a floating panel above the statusline.',
    keys: '<leader>... (any configured prefix)',
  },
  { id: 'ui', name: 'UI plugins', repos: ['folke/noice.nvim', 'nvim-lualine/lualine.nvim', 'akinsho/bufferline.nvim', 'rcarriga/nvim-notify', 'folke/trouble.nvim', 'folke/todo-comments.nvim'], status: 'unsupported', note: 'Visual or helper layers; the terminal has its own statusline and tabs.' },
  { id: 'session', name: 'Sessions and terminals', repos: ['rmagatti/auto-session', 'folke/persistence.nvim', 'akinsho/toggleterm.nvim'], status: 'unsupported', note: 'Needs a file system or a shell.' },
]

export const SHIMS = PLUGINS.filter((p) => p.status !== 'unsupported')

/** The plugins (from the list) whose repo is named anywhere in the given config texts. */
export function detectPlugins(texts: string[]): string[] {
  const all = texts.join('\n').toLowerCase()
  return PLUGINS.filter((p) => p.repos.some((r) => all.includes(r))).map((p) => p.id)
}

export const pluginById = (id: string) => PLUGINS.find((p) => p.id === id)

const KNOWN = new Set(PLUGINS.flatMap((p) => p.repos))

/**
 * Plugin repos named in config texts ("owner/name" in quotes) that the list does not know, so the user can ask for them.
 * Only names that look like Neovim plugins (nvim / vim / lua in the name, or a dot) are kept.
 */
export function findUnknownRepos(texts: string[]): string[] {
  const found = new Set<string>()
  for (const m of texts.join(' ').matchAll(/["']([\w.-]{2,}\/[\w.-]{2,})["']/g)) {
    const r = m[1].toLowerCase()
    if (KNOWN.has(r) || r.endsWith('lazy.nvim') || !/(nvim|vim|lua|\.)/.test(r.split('/')[1])) continue
    if (/\.(lua|vim|json|md|txt)$/.test(r) && !/\.nvim$/.test(r)) continue
    found.add(r)
  }
  return [...found].sort().slice(0, 80)
}

const ISSUES = 'https://github.com/andradev-io/nvim-skill-arcade-challenges/issues/new'

/** A prefilled GitHub issue asking for support of a plugin (or reporting a key that does not behave). */
export function requestUrl(plugin: string, kind: 'request' | 'bug' = 'request'): string {
  const title = kind === 'request' ? `Plugin support: ${plugin}` : `Plugin imitation bug: ${plugin}`
  const body =
    kind === 'request'
      ? `Plugin: https://github.com/${plugin.includes('/') ? plugin : '<owner>/<repo>'}

Keys I use most (e.g. \`gcc\`, \`<leader>ff\`):

- 

What it does for me:

`
      : `Plugin: ${plugin}

Keys pressed:

Expected (in Neovim):

Got (in the browser terminal):

`
  return `${ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
}
