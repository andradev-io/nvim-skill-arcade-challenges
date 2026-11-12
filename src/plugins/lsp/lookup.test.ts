import { describe, it, expect } from 'vitest'
import { findHover, findDefinition, findNextDiagnostic, findPrevDiagnostic } from './lookup'
import type { LspConfig } from '../../core/types'

const lspData: LspConfig = {
  hover: [
    { row: 1, col: 13, end_col: 18, text: 'function parse(input: string): table' },
    { row: 2, col: 0, end_col: 5, text: 'function print(...)' },
  ],
  definition: [
    { row: 1, col: 13, end_col: 18, target_row: 2, target_col: 0 },
  ],
  diagnostics: [
    { row: 1, col: 0, end_col: 5, severity: 'error', message: 'unused variable' },
    { row: 2, col: 6, end_col: 12, severity: 'warning', message: 'deprecated call' },
    { row: 3, col: 0, end_col: 3, severity: 'info', message: 'consider using const' },
  ],
}

describe('findHover', () => {
  it('returns matching hover entry when cursor is within range', () => {
    const result = findHover(lspData, { line: 0, ch: 15 })
    expect(result).not.toBeNull()
    expect(result?.text).toBe('function parse(input: string): table')
  })

  it('returns null when cursor is outside all ranges', () => {
    const result = findHover(lspData, { line: 0, ch: 0 })
    expect(result).toBeNull()
  })

  it('returns null when data is undefined', () => {
    expect(findHover(undefined, { line: 0, ch: 0 })).toBeNull()
  })

  it('matches exact col when end_col is not specified', () => {
    const data: LspConfig = { hover: [{ row: 1, col: 5, text: 'exact' }] }
    expect(findHover(data, { line: 0, ch: 5 })?.text).toBe('exact')
    expect(findHover(data, { line: 0, ch: 6 })).toBeNull()
  })
})

describe('findDefinition', () => {
  it('returns matching definition entry when cursor is within range', () => {
    const result = findDefinition(lspData, { line: 0, ch: 14 })
    expect(result).not.toBeNull()
    expect(result?.target_row).toBe(2)
    expect(result?.target_col).toBe(0)
  })

  it('returns null when cursor is outside all ranges', () => {
    expect(findDefinition(lspData, { line: 0, ch: 0 })).toBeNull()
  })

  it('returns null when data is undefined', () => {
    expect(findDefinition(undefined, { line: 0, ch: 0 })).toBeNull()
  })
})

describe('findNextDiagnostic', () => {
  it('finds next diagnostic after cursor position', () => {
    const result = findNextDiagnostic(lspData, { line: 0, ch: 0 })
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('warning')
    expect(result?.row).toBe(2)
  })

  it('wraps around to first diagnostic when cursor is past last', () => {
    const result = findNextDiagnostic(lspData, { line: 2, ch: 10 })
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('error')
    expect(result?.row).toBe(1)
  })

  it('returns null when no diagnostics exist', () => {
    expect(findNextDiagnostic({ diagnostics: [] }, { line: 0, ch: 0 })).toBeNull()
    expect(findNextDiagnostic(undefined, { line: 0, ch: 0 })).toBeNull()
  })
})

describe('findPrevDiagnostic', () => {
  it('finds previous diagnostic before cursor position', () => {
    const result = findPrevDiagnostic(lspData, { line: 2, ch: 5 })
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('warning')
    expect(result?.row).toBe(2)
  })

  it('wraps around to last diagnostic when cursor is before first', () => {
    const result = findPrevDiagnostic(lspData, { line: 0, ch: 0 })
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('info')
    expect(result?.row).toBe(3)
  })

  it('returns null when no diagnostics exist', () => {
    expect(findPrevDiagnostic({ diagnostics: [] }, { line: 0, ch: 0 })).toBeNull()
    expect(findPrevDiagnostic(undefined, { line: 0, ch: 0 })).toBeNull()
  })
})