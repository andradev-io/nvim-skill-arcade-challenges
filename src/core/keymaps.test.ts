import { describe, expect, it } from 'vitest'
import { loadSource, parseSource, pickCandidates } from './github'
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
  it('skips what cannot run, with a reason, and ignores comments', () => {
    expect(r.skipped.some((s) => /Telescope/.test(s.reason))).toBe(true)
    expect(r.skipped.some((s) => /Lua function/.test(s.reason))).toBe(true)
    expect(r.skipped.some((s) => /Plug/.test(s.reason))).toBe(true)
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
    expect(r.maps.map((m) => `${m.mode} ${m.lhs} ${m.rhs} ${m.noremap}`)).toEqual([
      'n ,w :w<CR> true',
      'i jk <Esc> true',
      'n Y y$ false',
      'v Y y$ false',
    ])
    expect(r.skipped).toHaveLength(1)
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
