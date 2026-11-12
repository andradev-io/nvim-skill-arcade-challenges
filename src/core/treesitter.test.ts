import { describe, expect, it } from 'vitest'
import { treesitterObjectAt } from '../plugins/textobjects'
import { replay } from './replay'
import type { TreesitterObjects, TsObjectEntry } from './types'

describe('treesitterObjectAt', () => {
  const funcEntry: TsObjectEntry = {
    inner: [2, 4, 3, 16],
    outer: [1, 0, 3, 16],
  }

  it('finds function containing cursor on line 2 (0-based line 1)', () => {
    const result = treesitterObjectAt([funcEntry], 1, 5, true)
    expect(result).toEqual([1, 4, 2, 16])
  })

  it('returns outer range when inner is false', () => {
    const result = treesitterObjectAt([funcEntry], 1, 5, false)
    expect(result).toEqual([0, 0, 2, 16])
  })

  it('returns null when cursor is outside all ranges', () => {
    const result = treesitterObjectAt([funcEntry], 5, 0, true)
    expect(result).toBeNull()
  })

  it('picks innermost when nested', () => {
    const outer: TsObjectEntry = { inner: [2, 4, 5, 10], outer: [1, 0, 6, 0] }
    const inner: TsObjectEntry = { inner: [3, 8, 4, 20], outer: [2, 4, 5, 10] }
    const result = treesitterObjectAt([outer, inner], 2, 10, true)
    expect(result).toEqual([2, 8, 3, 20])
  })

  it('returns null for empty array', () => {
    expect(treesitterObjectAt([], 0, 0, true)).toBeNull()
  })

  it('handles cursor at exact start boundary', () => {
    const result = treesitterObjectAt([funcEntry], 0, 0, true)
    expect(result).toEqual([1, 4, 2, 16])
  })

  it('returns null when cursor is at exclusive end column', () => {
    // endCol is exclusive, so col 16 on line 3 (0-based line 2) should not match
    const result = treesitterObjectAt([funcEntry], 2, 16, true)
    expect(result).toBeNull()
  })
})

describe('replay with treesitter objects', () => {
  const text = 'def greet(name):\n    print(f"Hello {name}")\n    return True\n\nx = 1'
  const tsObjs: TreesitterObjects = {
    function: [{ inner: [2, 4, 3, 16], outer: [1, 0, 3, 16] }],
    parameter: [{ inner: [1, 10, 1, 14], outer: [1, 10, 1, 14] }],
  }

  it('dif deletes inner function body', () => {
    const r = replay(text, [2, 5], 'dif', [], 'python', undefined, undefined, tsObjs)
    expect(r.text).toBe('def greet(name):\n\nx = 1')
    expect(r.unsupported).toBeNull()
  })

  it('daf deletes whole function including signature', () => {
    const r = replay(text, [2, 5], 'daf', [], 'python', undefined, undefined, tsObjs)
    expect(r.text).toBe('\nx = 1')
    expect(r.unsupported).toBeNull()
  })

  it('yaf yanks whole function without deleting', () => {
    const r = replay(text, [2, 5], 'yaf', [], 'python', undefined, undefined, tsObjs)
    expect(r.text).toBe(text)
    expect(r.unsupported).toBeNull()
  })

  it('cip changes parameter content', () => {
    const paramText = 'def greet(name):\n    pass'
    const paramTs: TreesitterObjects = {
      parameter: [{ inner: [1, 10, 1, 14], outer: [1, 10, 1, 14] }],
    }
    const r = replay(paramText, [1, 12], 'cipuser<Esc>', [], 'python', undefined, undefined, paramTs)
    expect(r.text).toBe('def greet(user):\n    pass')
    expect(r.unsupported).toBeNull()
  })

  it('falls back to bracket objects when no treesitter match', () => {
    // No treesitter objects provided; should use existing bracket-based logic
    const r = replay('foo(bar)', [1, 5], 'di(', [], 'text')
    expect(r.text).toBe('foo()')
    expect(r.unsupported).toBeNull()
  })
})