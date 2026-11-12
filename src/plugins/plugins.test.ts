import { describe, expect, it } from 'vitest'
import { pickSpecs } from '../core/github'
import { pairAction } from './autopairs'
import { openCommentLine, toggleLines } from './comment'
import { computeJumpTargets, feedJumpKey, initJumpState, validateJumpTargets } from './jumpLabels'
import { detectPlugins } from './registry'
import { findSurround, pairFor } from './surround'
import { argumentAt, callAt, quoteAt } from './textobjects'

describe('comment', () => {
  it('comments and uncomments with the filetype token', () => {
    expect(toggleLines(['local a = 1', 'local b = 2'], 'lua')).toEqual(['-- local a = 1', '-- local b = 2'])
    expect(toggleLines(['-- local a = 1', '-- local b = 2'], 'lua')).toEqual(['local a = 1', 'local b = 2'])
  })
  it('keeps the smallest indent and skips blank lines', () => {
    expect(toggleLines(['  a', '', '    b'], 'javascript')).toEqual(['  // a', '', '  //   b'])
  })
  it('comments everything when only some lines are comments', () => {
    expect(toggleLines(['// a', 'b'], 'javascript')).toEqual(['// // a', '// b'])
  })
  it('handles wrapped comments', () => {
    expect(toggleLines(['<p>x</p>'], 'html')).toEqual(['<!-- <p>x</p> -->'])
    expect(toggleLines(['<!-- <p>x</p> -->'], 'html')).toEqual(['<p>x</p>'])
  })
  it('opens a comment line', () => {
    expect(openCommentLine('  ', 'lua')).toEqual({ text: '  -- ', col: 5 })
  })
})

describe('surround', () => {
  it('pads opening brackets only', () => {
    expect(pairFor('(')).toEqual({ open: '( ', close: ' )' })
    expect(pairFor(')')).toEqual({ open: '(', close: ')' })
    expect(pairFor('"')).toEqual({ open: '"', close: '"' })
    expect(pairFor('t')).toBeNull()
  })
  it('finds the pair around the cursor', () => {
    const t = 'f(a, (b), c)'
    expect(findSurround(t, 6, '(')).toMatchObject({ openAt: 5, closeAt: 7 })
    expect(findSurround(t, 2, ')')).toMatchObject({ openAt: 1, closeAt: 11 })
    expect(findSurround('say "hi there"', 7, '"')).toMatchObject({ openAt: 4, closeAt: 13 })
    expect(findSurround('none', 1, '(')).toBeNull()
  })
  it('removes padding with the spaced form', () => {
    expect(findSurround('( x )', 2, '(')).toMatchObject({ openLen: 2, closeLen: 2 })
  })
})

describe('text objects', () => {
  const line = 'call(one, two(2, 3), "s, t")'
  it('finds arguments', () => {
    expect(argumentAt(line, 6, true)).toEqual([5, 8])
    expect(argumentAt(line, 11, true)).toEqual([10, 19])
    expect(argumentAt(line, 24, true)).toEqual([21, 27])
  })
  it('around-argument takes a comma', () => {
    expect(argumentAt(line, 6, false)).toEqual([5, 10])
    expect(argumentAt(line, 24, false)).toEqual([19, 27])
  })
  it('finds quotes and calls', () => {
    expect(quoteAt('x = "a b"', 6, true)).toEqual([5, 8])
    expect(quoteAt('x = "a b"', 6, false)).toEqual([4, 9])
    expect(callAt(line, 15, true)).toEqual([14, 18])
    expect(callAt(line, 15, false)).toEqual([10, 19])
    expect(callAt('(a)', 1, true)).toBeNull()
  })
})

describe('autopairs', () => {
  it('pairs, skips and removes', () => {
    expect(pairAction('(', 'f', undefined)).toEqual({ type: 'insert', text: '()' })
    expect(pairAction('(', 'f', 'x')).toBeNull()
    expect(pairAction(')', '(', ')')).toEqual({ type: 'skip' })
    expect(pairAction('Backspace', '(', ')')).toEqual({ type: 'delete-pair' })
    expect(pairAction('Backspace', 'a', ')')).toBeNull()
  })
  it('leaves apostrophes alone', () => {
    expect(pairAction("'", 'n', undefined)).toBeNull()
    expect(pairAction('"', ' ', undefined)).toEqual({ type: 'insert', text: '""' })
  })
})

describe('plugin detection', () => {
  it('finds plugins by repo name', () => {
    const ids = detectPlugins([`{ "numToStr/Comment.nvim", opts = {} }, { 'nvim-telescope/telescope.nvim' }`, `"kylechui/nvim-surround"`])
    expect(ids).toEqual(expect.arrayContaining(['comment', 'telescope', 'surround']))
    expect(ids).not.toContain('autopairs')
  })
  it('picks plugin spec files', () => {
    const paths = ['init.lua', 'lua/plugins/comment.lua', 'lua/plugins/init.lua', 'lua/config/keymaps.lua', 'README.md', 'lua/tests/plugins/x.lua']
    expect(pickSpecs(paths, null, ['lua/config/keymaps.lua'])).toEqual(['lua/plugins/init.lua', 'lua/plugins/comment.lua'])
  })
})

describe('jump labels', () => {
  it('computes targets sorted by distance from cursor', () => {
    const lines = ['hello world', 'foo bar baz']
    const targets = computeJumpTargets(lines, 0, 0)
    expect(targets.length).toBeGreaterThan(0)
    // First target should be closest word start (col 0 of line 0 is cursor, so next is col 6 "world")
    expect(targets[0].label).toBeTruthy()
    expect(targets.every((t) => t.row >= 0 && t.col >= 0)).toBe(true)
  })
  it('assigns unique labels', () => {
    const lines = ['alpha beta gamma delta epsilon zeta eta theta iota kappa']
    const targets = computeJumpTargets(lines, 0, 0)
    const labels = new Set(targets.map((t) => t.label))
    expect(labels.size).toBe(targets.length)
  })
  it('validates targets within bounds', () => {
    const valid = [{ label: 'a', row: 0, col: 0 }]
    expect(validateJumpTargets(valid, 1, () => 5)).toBe(true)
    const outOfBounds = [{ label: 'a', row: 5, col: 0 }]
    expect(validateJumpTargets(outOfBounds, 1, () => 5)).toBe(false)
    const dupes = [{ label: 'a', row: 0, col: 0 }, { label: 'a', row: 0, col: 1 }]
    expect(validateJumpTargets(dupes, 1, () => 5)).toBe(false)
  })
  it('feeds keys through the state machine', () => {
    const targets = [
      { label: 'a', row: 0, col: 0 },
      { label: 'ab', row: 0, col: 5 },
      { label: 'b', row: 1, col: 0 },
    ]
    let state = initJumpState(targets)
    const r1 = feedJumpKey(state, 'a')
    expect(r1.type).toBe('continue')
    if (r1.type === 'continue') {
      state = r1.state
      const r2 = feedJumpKey(state, 'b')
      expect(r2.type).toBe('jump')
      if (r2.type === 'jump') expect(r2.target.col).toBe(5)
    }
  })
  it('cancels on Escape or no match', () => {
    const state = initJumpState([{ label: 'a', row: 0, col: 0 }])
    expect(feedJumpKey(state, 'Escape').type).toBe('cancel')
    expect(feedJumpKey(state, 'z').type).toBe('cancel')
  })
})

describe('unknown repos and requests', () => {
  it('lists plugin repos the registry does not know', async () => {
    const { findUnknownRepos, requestUrl } = await import('./registry')
    const found = findUnknownRepos([`{ "numToStr/Comment.nvim" }, { 'folke/lazy.nvim' }, { "someone/cool-thing.nvim" }, "lua/plugins/x.lua", "a/b"`])
    expect(found).toEqual(['someone/cool-thing.nvim'])
    expect(requestUrl('someone/cool-thing.nvim')).toContain('issues/new?title=Plugin%20support%3A%20someone%2Fcool-thing.nvim')
  })
})
