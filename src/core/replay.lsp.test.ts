import { describe, it, expect } from 'vitest'
import { replay } from './replay'
import type { LspConfig } from './types'

const lspData: LspConfig = {
  hover: [{ row: 1, col: 13, end_col: 18, text: 'function parse(input: string): table' }],
  definition: [{ row: 1, col: 13, end_col: 18, target_row: 2, target_col: 0 }],
  diagnostics: [
    { row: 1, col: 0, end_col: 5, severity: 'error' },
    { row: 2, col: 6, end_col: 12, severity: 'warning' },
    { row: 3, col: 0, end_col: 3, severity: 'info' },
  ],
}

const text = 'local result = parse(input)\nprint(result)\nfoo()'

describe('replay LSP tokens', () => {
  it('K produces no state change (hover is UI-only)', () => {
    const result = replay(text, [1, 14], 'K', [], 'lua', undefined, undefined, undefined, lspData)
    expect(result.cursor).toEqual([1, 14])
    expect(result.unsupported).toBeNull()
  })

  it('gd moves cursor to definition target', () => {
    const result = replay(text, [1, 14], 'gd', [], 'lua', undefined, undefined, undefined, lspData)
    expect(result.cursor).toEqual([2, 0])
    expect(result.unsupported).toBeNull()
  })

  it(']d advances to next diagnostic', () => {
    const result = replay(text, [1, 0], ']d', [], 'lua', undefined, undefined, undefined, lspData)
    expect(result.cursor).toEqual([2, 6])
    expect(result.unsupported).toBeNull()
  })

  it('[d retreats to previous diagnostic', () => {
    const result = replay(text, [3, 5], '[d', [], 'lua', undefined, undefined, undefined, lspData)
    expect(result.cursor).toEqual([2, 6])
    expect(result.unsupported).toBeNull()
  })

  it('missing lspData causes ] and [ to be unsupported', () => {
    const r1 = replay(text, [1, 0], ']d', [], 'lua')
    expect(r1.unsupported).toBe(']')
    const r2 = replay(text, [1, 0], '[d', [], 'lua')
    expect(r2.unsupported).toBe('[')
  })

  it('K with missing lspData is a no-op (not unsupported)', () => {
    const result = replay(text, [1, 14], 'K', [], 'lua')
    expect(result.cursor).toEqual([1, 14])
    expect(result.unsupported).toBeNull()
  })
})