import { describe, expect, it } from 'vitest'
import { filterAi, filterOptions, NO_FILTERS, parsePrompt, sortNewest } from './ai'
import type { Challenge } from './types'

const mk = (id: string, over: Partial<Challenge>): Challenge => ({
  id, title: id, area: 'editing', level: 1, brief: '', text: 'a', cursor: [1, 0], expect: { text: 'b' }, solution: 'x', why: '', generated: true, ...over,
})
const list = [
  mk('a', { date: '2026-03-01', model: 'm1' }),
  mk('b', { date: '2026-03-03', area: 'search', level: 2, model: 'm2', ft: 'go' }),
  mk('c', { date: '2026-03-03', level: 3, model: 'm1' }),
]

describe('ai challenges', () => {
  it('sorts newest first, then by id', () => {
    expect(sortNewest(list).map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })
  it('filters by every field, empty matches all', () => {
    expect(filterAi(list, NO_FILTERS)).toHaveLength(3)
    expect(filterAi(list, { ...NO_FILTERS, date: '2026-03-03' }).map((c) => c.id)).toEqual(['b', 'c'])
    expect(filterAi(list, { ...NO_FILTERS, area: 'search' }).map((c) => c.id)).toEqual(['b'])
    expect(filterAi(list, { ...NO_FILTERS, level: '3' }).map((c) => c.id)).toEqual(['c'])
    expect(filterAi(list, { ...NO_FILTERS, ft: 'go' }).map((c) => c.id)).toEqual(['b'])
    expect(filterAi(list, { ...NO_FILTERS, ft: 'text' }).map((c) => c.id)).toEqual(['a', 'c'])
    expect(filterAi(list, { ...NO_FILTERS, model: 'm1', area: 'editing' }).map((c) => c.id)).toEqual(['a', 'c'])
  })
  it('lists the distinct options', () => {
    const o = filterOptions(list)
    expect(o.date).toEqual(['2026-03-03', '2026-03-01'])
    expect(o.model).toEqual(['m1', 'm2'])
    expect(o.ft).toEqual(['go', 'text'])
    expect(o.level).toEqual(['1', '2', '3'])
  })
  it('reads the prompt provenance', () => {
    expect(parsePrompt('v1.1:abcdef123456')).toEqual({ version: '1.1', hash: 'abcdef123456' })
    expect(parsePrompt('nope')).toBeNull()
    expect(parsePrompt(undefined)).toBeNull()
  })
})
