import { describe, it, expect } from 'vitest'
import {
  whichKeyStep,
  buildWhichKeyFromMaps,
  buildWhichKeyFromChallenge,
  initialWhichKeyState,
} from './whichKey'
import type { WhichKeyConfig, WhichKeyState } from './whichKey'
import type { Keymap } from './keymaps'

// ---------- Helpers ----------

function makeConfig(timeoutMs = 500): WhichKeyConfig {
  const roots = new Map()
  // <Space> prefix with entries: f (find file), g (git), b (buffer)
  const spaceNode = {
    prefix: '<Space>',
    entries: [
      { key: 'f', label: 'Find file', group: 'file' },
      { key: 'g', label: 'Git status', group: 'git' },
      { key: 'b', label: 'Buffers', group: 'buffer' },
    ],
    children: new Map([
      [
        'g',
        {
          prefix: '<Space>g',
          entries: [
            { key: 's', label: 'Status', group: 'git' },
            { key: 'd', label: 'Diff', group: 'git' },
          ],
          children: new Map(),
        },
      ],
    ]),
  }
  roots.set('<Space>', spaceNode)
  return { roots, timeoutMs }
}

// ---------- State machine tests ----------

describe('whichKeyStep', () => {
  const config = makeConfig()
  const idle = initialWhichKeyState()

  it('starts idle', () => {
    expect(idle.visible).toBe(false)
    expect(idle.node).toBeNull()
    expect(idle.typed).toEqual([])
  })

  it('keydown with matching root starts tracking', () => {
    const next = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    expect(next.visible).toBe(false)
    expect(next.node).not.toBeNull()
    expect(next.node!.prefix).toBe('<Space>')
    expect(next.typed).toEqual(['<Space>'])
  })

  it('keydown with non-matching key stays idle', () => {
    const next = whichKeyStep(config, idle, { type: 'keydown', key: 'x' })
    expect(next.visible).toBe(false)
    expect(next.node).toBeNull()
  })

  it('timeout shows overlay when tracking', () => {
    const tracking = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    const visible = whichKeyStep(config, tracking, { type: 'timeout' })
    expect(visible.visible).toBe(true)
    expect(visible.node!.entries.length).toBe(3)
  })

  it('timeout does nothing when idle', () => {
    const next = whichKeyStep(config, idle, { type: 'timeout' })
    expect(next.visible).toBe(false)
    expect(next.node).toBeNull()
  })

  it('matching key while visible dismisses overlay', () => {
    const tracking = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    const visible = whichKeyStep(config, tracking, { type: 'timeout' })
    const dismissed = whichKeyStep(config, visible, { type: 'keydown', key: 'f' })
    expect(dismissed.visible).toBe(false)
    expect(dismissed.node).toBeNull()
  })

  it('non-matching key while visible resets', () => {
    const tracking = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    const visible = whichKeyStep(config, tracking, { type: 'timeout' })
    const reset = whichKeyStep(config, visible, { type: 'keydown', key: 'z' })
    expect(reset.visible).toBe(false)
    expect(reset.node).toBeNull()
  })

  it('child navigation works before overlay is visible', () => {
    const s1 = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    const s2 = whichKeyStep(config, s1, { type: 'keydown', key: 'g' })
    expect(s2.visible).toBe(false)
    expect(s2.node!.prefix).toBe('<Space>g')
    expect(s2.typed).toEqual(['<Space>', 'g'])
  })

  it('child entries appear after timeout at child level', () => {
    const s1 = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    const s2 = whichKeyStep(config, s1, { type: 'keydown', key: 'g' })
    const s3 = whichKeyStep(config, s2, { type: 'timeout' })
    expect(s3.visible).toBe(true)
    expect(s3.node!.entries.length).toBe(2)
    expect(s3.node!.entries[0].key).toBe('s')
  })

  it('reset always returns to idle', () => {
    const tracking = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    const visible = whichKeyStep(config, tracking, { type: 'timeout' })
    const reset = whichKeyStep(config, visible, { type: 'reset' })
    expect(reset.visible).toBe(false)
    expect(reset.node).toBeNull()
    expect(reset.typed).toEqual([])
  })

  it('completing a mapping (entry match before visible) resets', () => {
    const s1 = whichKeyStep(config, idle, { type: 'keydown', key: '<Space>' })
    // Press 'f' which is a direct entry — should complete and reset
    const s2 = whichKeyStep(config, s1, { type: 'keydown', key: 'f' })
    expect(s2.visible).toBe(false)
    expect(s2.node).toBeNull()
  })
})

// ---------- Builder tests ----------

describe('buildWhichKeyFromMaps', () => {
  it('builds tree from multi-char normal-mode mappings', () => {
    const maps: Keymap[] = [
      { mode: 'n', lhs: '<Space>ff', rhs: ':Telescope find_files<CR>', noremap: true, file: 'init.lua', line: 1 },
      { mode: 'n', lhs: '<Space>fg', rhs: ':Telescope live_grep<CR>', noremap: true, file: 'init.lua', line: 2 },
      { mode: 'n', lhs: '<Space>gs', rhs: ':Git status<CR>', noremap: true, file: 'init.lua', line: 3 },
    ]
    const config = buildWhichKeyFromMaps(maps, '<Space>')
    expect(config.roots.size).toBe(1)
    const space = config.roots.get('<Space>')!
    expect(space.entries.length).toBe(0) // no direct entries at <Space> level
    expect(space.children.size).toBe(2) // 'f' and 'g' children
    const fChild = space.children.get('f')!
    expect(fChild.entries.length).toBe(2) // ff and fg
  })

  it('skips single-key mappings', () => {
    const maps: Keymap[] = [
      { mode: 'n', lhs: 'j', rhs: 'gj', noremap: true, file: 'init.lua', line: 1 },
    ]
    const config = buildWhichKeyFromMaps(maps, '\\')
    expect(config.roots.size).toBe(0)
  })

  it('skips non-normal mode mappings', () => {
    const maps: Keymap[] = [
      { mode: 'i', lhs: '<Space>jj', rhs: '<Esc>', noremap: true, file: 'init.lua', line: 1 },
    ]
    const config = buildWhichKeyFromMaps(maps, '<Space>')
    expect(config.roots.size).toBe(0)
  })

  it('skips stub mappings', () => {
    const maps: Keymap[] = [
      { mode: 'n', lhs: '<Space>x', rhs: '', noremap: true, note: 'stub', file: 'init.lua', line: 1 },
    ]
    const config = buildWhichKeyFromMaps(maps, '<Space>')
    expect(config.roots.size).toBe(0)
  })
})

describe('buildWhichKeyFromChallenge', () => {
  it('builds tree from challenge data', () => {
    const data = {
      prefixes: [
        {
          trigger: '<Space>',
          entries: [
            { key: 'f', label: 'Find files', group: 'search' },
            { key: 'b', label: 'Buffers', group: 'buffer' },
          ],
          children: [
            {
              trigger: 'g',
              entries: [
                { key: 's', label: 'Status' },
                { key: 'l', label: 'Log' },
              ],
            },
          ],
        },
      ],
      timeout_ms: 600,
    }
    const config = buildWhichKeyFromChallenge(data)
    expect(config.timeoutMs).toBe(600)
    expect(config.roots.size).toBe(1)
    const space = config.roots.get('<Space>')!
    expect(space.entries.length).toBe(2)
    expect(space.children.size).toBe(1)
    const gChild = space.children.get('g')!
    expect(gChild.entries.length).toBe(2)
  })

  it('uses default timeout when not specified', () => {
    const data = {
      prefixes: [{ trigger: 'g', entries: [{ key: 'd', label: 'Definition' }] }],
    }
    const config = buildWhichKeyFromChallenge(data)
    expect(config.timeoutMs).toBe(800)
  })
})