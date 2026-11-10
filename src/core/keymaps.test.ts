import { describe, expect, it } from 'vitest'
import { loadSource, parseSource, pickCandidates } from './github'
import { moveLines, resolveAddress } from '../components/play/exCommands'
import { findLeader, luaString, normaliseKeys, parseConfig, parseKeymaps } from './keymaps'

describe('lua strings and notation', () => {
  it('reads plain literals only', () => {
    expect(luaString('"abc"')).toBe('abc')
    expect(luaString(" '<cmd>w<CR>' ")).toBe('<cmd>w<CR>')
    expect(luaString('[[x y]]')).toBe('x y')
    expect(luaString('"a" .. b')).toBeNull()
    expect(luaString('function() end')).toBeNull()
  })
  it('normalises keys and expands the leader', () => {
    expect(normaliseKeys('<leader>w<cr>', ' ')).toBe('<Space>w<CR>')
    expect(normaliseKeys('<c-D>zz', '\\')).toBe('<C-d>zz')
    expect(normaliseKeys('<LEADER>x', ',')).toBe(',x')
  })
  it('finds the leader in Lua and Vimscript', () => {
    expect(findLeader('vim.g.mapleader = " "')).toBe(' ')
    expect(findLeader('-- vim.g.mapleader = ","\nvim.g.mapleader = ";"')).toBe(';')
    expect(findLeader('let mapleader = ","')).toBe(',')
    expect(findLeader('nothing here')).toBeNull()
  })
})

describe('parseKeymaps (Lua)', () => {
  const lua = `
    vim.g.mapleader = " "
    local map = vim.keymap.set
    map("n", "<leader>q", function() local x = 1 print(x) end)
    vim.keymap.set("n", "<leader>w", "<cmd>w<CR>", { desc = "save" })
    vim.keymap.set({ "n", "v" }, "<C-d>", "<C-d>zz")
    map("i", "jk", "<Esc>", { silent = true })
    map("n", "<leader>ff", "<cmd>Telescope find_files<cr>")
    map("n", "<leader>e", function() vim.cmd("Ex") end)
    map("n", "gx", "<Plug>(open-url)")
    map("n", "H", "^", { remap = true })
    map("t", "<Esc>", "<C-\\\\><C-n>")
    -- map("n", "q", "x")
    vim.keymap.set(
      "n",
      "<leader>h",
      "<cmd>nohlsearch<CR>"
    )
    local function bind(mode, lhs, rhs) vim.keymap.set(mode, lhs, rhs) end
    bind("n", "Q", "<nop>")
  `
  const r = parseKeymaps(lua, 'init.lua', ' ')
  const has = (mode: string, lhs: string, rhs: string) => r.maps.some((m) => m.mode === mode && m.lhs === lhs && m.rhs === rhs)
  it('keeps the plain ones, in key notation the editor uses', () => {
    expect(has('n', '<Space>w', ':w<CR>')).toBe(true)
    expect(has('n', '<C-d>', '<C-d>zz')).toBe(true)
    expect(has('v', '<C-d>', '<C-d>zz')).toBe(true)
    expect(has('i', 'jk', '<Esc>')).toBe(true)
    expect(has('n', '<Space>h', ':nohlsearch<CR>')).toBe(true)
    expect(has('n', 'Q', '<Nop>')).toBe(true)
  })
  it('honours remap and noremap', () => {
    expect(r.maps.find((m) => m.lhs === 'H')?.noremap).toBe(false)
    expect(r.maps.find((m) => m.lhs === 'jk')?.noremap).toBe(true)
  })
  it('turns what needs a plugin or Lua into a stub that says why, and ignores comments', () => {
    const note = (lhs: string) => r.maps.find((m) => m.lhs === lhs)?.note ?? ''
    expect(note('<Space>ff')).toMatch(/Telescope.*needs a plugin or Neovim/)
    expect(note('<Space>e')).toMatch(/Ex needs a plugin/)
    expect(note('<Space>q')).toMatch(/runs Lua/)
    expect(note('gx')).toMatch(/plugin mapping/)
    expect(r.maps.find((m) => m.lhs === '<Space>w')?.note).toBeUndefined()
    expect(r.skipped.some((s) => /mode 't'/.test(s.reason))).toBe(true)
    expect(r.maps.some((m) => m.lhs === 'q')).toBe(false)
  })
  it('does not report a wrapper body as a mapping of its own', () => {
    expect(r.skipped.some((s) => /bind|mode, lhs/.test(s.text))).toBe(false)
  })
})

describe('parseKeymaps (Vimscript)', () => {
  it('reads nmap, noremap and flags', () => {
    const r = parseKeymaps(
      ['nnoremap <silent> <leader>w :w<CR>', 'inoremap jk <Esc>', 'map Y y$', 'nmap <expr> j v:count ? "j" : "gj"', '" nnoremap x y'].join('\n'),
      'init.vim',
      ',',
    )
    expect(r.maps.filter((m) => !m.note).map((m) => `${m.mode} ${m.lhs} ${m.rhs} ${m.noremap}`)).toEqual([
      'n ,w :w<CR> true',
      'i jk <Esc> true',
      'n Y y$ false',
      'v Y y$ false',
    ])
    // the <expr> mapping is kept as a stub that says so
    expect(r.maps.find((m) => m.lhs === 'j')?.note).toMatch(/expression/)
    expect(r.skipped).toHaveLength(0)
  })
})

describe('mappings from a real config', () => {
  const r = parseKeymaps(
    [
      'local map = vim.keymap.set',
      'map("n", "<leader>x", "<cmd>close<CR>", { desc = "close window" })',
      'map("n", "<leader>tn", "<cmd>tabnew<CR>")',
      'map("n", "<leader>bn", "<cmd>bn<CR>")',
      'map("n", "<A-j>", ":m .+1<CR>==")',
      'map("v", "<A-j>", ":m \'>+1<CR>gv=gv")',
      'map("n", "<leader>h", "<cmd>echo \\"hi\\"<CR>")',
      'map("n", "<leader>e", "<cmd>NvimTreeToggle<CR>")',
      'map("n", "<leader>ff", builtin.find_files, { desc = "find files" })',
      'map("n", "<leader>z", function() vim.cmd("normal! zz") end)',
      'map("n", "<leader>hh", function() vim.lsp.buf.hover() end)',
      'map("n", "<leader>fb", function() require("telescope.builtin").buffers() end)',
    ].join('\n'),
    'lazy-remap.lua',
    ' ',
  )
  const find = (lhs: string, mode = 'n') => r.maps.find((m) => m.lhs === lhs && m.mode === mode)
  it('works for window, tab, buffer, move and echo commands', () => {
    for (const lhs of ['<Space>x', '<Space>tn', '<Space>bn', '<A-j>', '<Space>h']) expect(find(lhs)?.note).toBeUndefined()
    expect(find('<A-j>', 'v')?.note).toBeUndefined()
    expect(find('<Space>tn')?.rhs).toBe(':tabnew<CR>')
  })
  it('reads a function that only runs vim.cmd as the command', () => {
    expect(find('<Space>z')?.rhs).toBe(':normal! zz<CR>')
    expect(find('<Space>z')?.note).toBeUndefined()
  })
  it('stubs plugin commands and functions, labelled by desc or the call', () => {
    expect(find('<Space>e')?.note).toMatch(/NvimTreeToggle/)
    expect(find('<Space>ff')?.note).toMatch(/find files/)
    expect(find('<Space>hh')?.note).toMatch(/vim\.lsp\.buf\.hover/)
    expect(find('<Space>fb')?.note).toMatch(/require/)
    expect(r.skipped).toHaveLength(0)
  })
})

describe(':move', () => {
  const lines = ['a', 'b', 'c', 'd', 'e']
  it('resolves addresses', () => {
    expect(resolveAddress('.+1', 2, 5, {})).toBe(3)
    expect(resolveAddress('-2', 4, 5, {})).toBe(2)
    expect(resolveAddress('$', 2, 5, {})).toBe(5)
    expect(resolveAddress('0', 2, 5, {})).toBe(0)
    expect(resolveAddress("'>+1", 2, 5, { '>': 3 })).toBe(4)
    expect(resolveAddress('.+99', 2, 5, {})).toBe(5)
    expect(resolveAddress('foo', 2, 5, {})).toBeNull()
  })
  it('moves lines down, up, to the top and refuses to move into itself', () => {
    expect(moveLines(lines, 2, 2, 3)?.lines.join('')).toBe('acbde')
    expect(moveLines(lines, 3, 3, 1)?.lines.join('')).toBe('acbde')
    expect(moveLines(lines, 2, 3, 5)?.lines.join('')).toBe('adebc')
    expect(moveLines(lines, 4, 4, 0)?.lines.join('')).toBe('dabce')
    expect(moveLines(lines, 2, 4, 3)).toBeNull()
  })
})

describe('parseConfig', () => {
  it('uses the leader from any file and lets later files win', () => {
    const r = parseConfig([
      { path: 'lua/keymaps.lua', text: 'vim.keymap.set("n", "<leader>a", "x")' },
      { path: 'init.lua', text: 'vim.g.mapleader = " "\nvim.keymap.set("n", "<leader>a", "y")' },
    ])
    expect(r.leader).toBe(' ')
    expect(r.maps).toHaveLength(1)
    expect(r.maps[0].rhs).toBe('y')
    expect(r.maps[0].lhs).toBe('<Space>a')
  })
})

describe('github source', () => {
  it('understands the common ways to name a config', () => {
    expect(parseSource('vinicius')).toMatchObject({ owner: 'vinicius', repo: null })
    expect(parseSource('vinicius/dotfiles')).toMatchObject({ repo: 'dotfiles', path: null, isFile: false })
    expect(parseSource('https://github.com/a/b/blob/main/nvim/lua/keymaps.lua')).toMatchObject({
      owner: 'a', repo: 'b', ref: 'main', path: 'nvim/lua/keymaps.lua', isFile: true,
    })
    expect(parseSource('github.com/a/b/tree/dev/nvim')).toMatchObject({ ref: 'dev', path: 'nvim', isFile: false })
    expect(parseSource('https://raw.githubusercontent.com/a/b/main/init.lua')).toMatchObject({ path: 'init.lua', isFile: true })
    expect(parseSource('a/b/nvim/init.lua')).toMatchObject({ path: 'nvim/init.lua', isFile: true })
    expect(parseSource('   ')).toBeNull()
  })
  it('picks keymap files first, then init files', () => {
    const paths = ['README.md', 'nvim/init.lua', 'nvim/lua/config/keymaps.lua', 'zsh/aliases.zsh', 'node_modules/x/keymaps.lua', 'nvim/lua/plugins/lsp.lua']
    expect(pickCandidates(paths)).toEqual(['nvim/lua/config/keymaps.lua', 'nvim/init.lua'])
    expect(pickCandidates(paths, 'other')).toEqual([])
  })
  it('loads through an injected fetch, trying common repo names for a bare user', async () => {
    const calls: string[] = []
    const fake = (async (url: string) => {
      calls.push(url)
      if (url.includes('/repos/u/dotfiles/')) return new Response('', { status: 404 })
      if (url.includes('/repos/u/nvim/')) {
        return new Response(JSON.stringify({ tree: [{ path: 'lua/keymaps.lua', type: 'blob' }] }), { status: 200 })
      }
      if (url.includes('raw.githubusercontent.com/u/nvim/')) return new Response('vim.keymap.set("n","x","y")', { status: 200 })
      return new Response('', { status: 404 })
    }) as unknown as typeof fetch
    const src = parseSource('u')!
    const files = await loadSource(src, fake)
    expect(files).toEqual([{ path: 'lua/keymaps.lua', text: 'vim.keymap.set("n","x","y")' }])
    expect(calls[0]).toContain('/repos/u/dotfiles/')
  })
  it('explains a rate limit', async () => {
    const fake = (async () => new Response('', { status: 403 })) as unknown as typeof fetch
    await expect(loadSource(parseSource('u/r')!, fake)).rejects.toThrow(/rate limit/)
  })
})
