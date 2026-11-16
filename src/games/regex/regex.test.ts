import { describe, expect, it } from 'vitest'
import { evaluateRegex, matchesExactly } from './matching'
import type { RegexTarget } from './types'

describe('evaluateRegex', () => {
  it('matches literal text across multiple lines', () => {
    const lines = ['hello world', 'goodbye world']
    const found = evaluateRegex('world', lines)
    expect(found).toEqual([
      { line: 0, startCol: 6, endCol: 11 },
      { line: 1, startCol: 8, endCol: 13 },
    ])
  })

  it('returns empty array for no matches', () => {
    const lines = ['abc def', 'ghi jkl']
    const found = evaluateRegex('xyz', lines)
    expect(found).toEqual([])
  })

  it('returns empty array for invalid pattern', () => {
    const lines = ['test']
    const found = evaluateRegex('[invalid', lines)
    expect(found).toEqual([])
  })

  it('returns empty array for empty pattern', () => {
    const lines = ['test']
    const found = evaluateRegex('', lines)
    expect(found).toEqual([])
  })

  it('matches character classes', () => {
    const lines = ['cat bat hat']
    const found = evaluateRegex('[cbh]at', lines)
    expect(found).toEqual([
      { line: 0, startCol: 0, endCol: 3 },
      { line: 0, startCol: 4, endCol: 7 },
      { line: 0, startCol: 8, endCol: 11 },
    ])
  })

  it('matches digit shorthand class', () => {
    const lines = ['item1 item2 itemA']
    const found = evaluateRegex('\\d', lines)
    expect(found).toEqual([
      { line: 0, startCol: 4, endCol: 5 },
      { line: 0, startCol: 10, endCol: 11 },
    ])
  })

  it('matches dot wildcard', () => {
    const lines = ['abc']
    const found = evaluateRegex('.b.', lines)
    expect(found).toEqual([
      { line: 0, startCol: 0, endCol: 3 },
    ])
  })

  it('matches quantifier + (one or more)', () => {
    const lines = ['aaa bb c']
    const found = evaluateRegex('a+', lines)
    expect(found).toEqual([
      { line: 0, startCol: 0, endCol: 3 },
    ])
  })

  it('matches quantifier * (zero or more)', () => {
    const lines = ['ab aab b']
    const found = evaluateRegex('a*b', lines)
    expect(found).toEqual([
      { line: 0, startCol: 0, endCol: 2 },
      { line: 0, startCol: 3, endCol: 6 },
      { line: 0, startCol: 7, endCol: 8 },
    ])
  })

  it('matches anchor ^ at start of line', () => {
    const lines = ['start middle', 'no start here']
    const found = evaluateRegex('^start', lines)
    expect(found).toEqual([
      { line: 0, startCol: 0, endCol: 5 },
    ])
  })

  it('matches anchor $ at end of line', () => {
    const lines = ['hello end', 'end hello']
    const found = evaluateRegex('end$', lines)
    expect(found).toEqual([
      { line: 0, startCol: 6, endCol: 9 },
    ])
  })

  it('handles multiple matches on same line', () => {
    const lines = ['foo bar foo baz foo']
    const found = evaluateRegex('foo', lines)
    expect(found).toEqual([
      { line: 0, startCol: 0, endCol: 3 },
      { line: 0, startCol: 8, endCol: 11 },
      { line: 0, startCol: 16, endCol: 19 },
    ])
  })
})

describe('matchesExactly', () => {
  const makeTarget = (line: number, start: number, end: number): RegexTarget => ({
    line,
    startCol: start,
    endCol: end,
  })

  it('returns true for identical sets', () => {
    const a = [makeTarget(0, 0, 3), makeTarget(1, 4, 7)]
    const b = [makeTarget(0, 0, 3), makeTarget(1, 4, 7)]
    expect(matchesExactly(a, b)).toBe(true)
  })

  it('returns true regardless of order', () => {
    const a = [makeTarget(1, 4, 7), makeTarget(0, 0, 3)]
    const b = [makeTarget(0, 0, 3), makeTarget(1, 4, 7)]
    expect(matchesExactly(a, b)).toBe(true)
  })

  it('returns false when found has extra matches', () => {
    const found = [makeTarget(0, 0, 3), makeTarget(0, 4, 7)]
    const expected = [makeTarget(0, 0, 3)]
    expect(matchesExactly(found, expected)).toBe(false)
  })

  it('returns false when found is missing matches', () => {
    const found = [makeTarget(0, 0, 3)]
    const expected = [makeTarget(0, 0, 3), makeTarget(0, 4, 7)]
    expect(matchesExactly(found, expected)).toBe(false)
  })

  it('returns false for different positions', () => {
    const found = [makeTarget(0, 0, 3)]
    const expected = [makeTarget(0, 1, 4)]
    expect(matchesExactly(found, expected)).toBe(false)
  })

  it('returns true for both empty arrays', () => {
    expect(matchesExactly([], [])).toBe(true)
  })

  it('returns false when one is empty and other is not', () => {
    expect(matchesExactly([], [makeTarget(0, 0, 1)])).toBe(false)
    expect(matchesExactly([makeTarget(0, 0, 1)], [])).toBe(false)
  })
})