import type { CardPair } from './types'

const motionCards: CardPair[] = [
  { id: 'motion-h', command: 'h', description: 'move left', category: 'motion' },
  { id: 'motion-j', command: 'j', description: 'move down', category: 'motion' },
  { id: 'motion-k', command: 'k', description: 'move up', category: 'motion' },
  { id: 'motion-l', command: 'l', description: 'move right', category: 'motion' },
  { id: 'motion-w', command: 'w', description: 'word forward', category: 'motion' },
  { id: 'motion-b', command: 'b', description: 'word backward', category: 'motion' },
  { id: 'motion-e', command: 'e', description: 'end of word', category: 'motion' },
  { id: 'motion-0', command: '0', description: 'line start', category: 'motion' },
  { id: 'motion-$', command: '$', description: 'line end', category: 'motion' },
  { id: 'motion-gg', command: 'gg', description: 'file start', category: 'motion' },
  { id: 'motion-G', command: 'G', description: 'file end', category: 'motion' },
  { id: 'motion-f', command: 'f{c}', description: 'find char', category: 'motion' },
  { id: 'motion-t', command: 't{c}', description: 'till char', category: 'motion' },
]

const operatorCards: CardPair[] = [
  { id: 'op-d', command: 'd', description: 'delete', category: 'operator' },
  { id: 'op-y', command: 'y', description: 'yank (copy)', category: 'operator' },
  { id: 'op-c', command: 'c', description: 'change', category: 'operator' },
  { id: 'op->', command: '>', description: 'indent', category: 'operator' },
  { id: 'op-<', command: '<', description: 'dedent', category: 'operator' },
]

const textObjectCards: CardPair[] = [
  { id: 'to-iw', command: 'iw', description: 'inner word', category: 'text-object' },
  { id: 'to-aw', command: 'aw', description: 'a word', category: 'text-object' },
  { id: 'to-iq', command: 'i"', description: 'inner quotes', category: 'text-object' },
  { id: 'to-aq', command: 'a"', description: 'with quotes', category: 'text-object' },
  { id: 'to-ip', command: 'i(', description: 'inner parens', category: 'text-object' },
  { id: 'to-ap', command: 'a(', description: 'with parens', category: 'text-object' },
  { id: 'to-ipp', command: 'ip', description: 'inner paragraph', category: 'text-object' },
]

const comboCards: CardPair[] = [
  { id: 'combo-dw', command: 'dw', description: 'delete word', category: 'combo' },
  { id: 'combo-dd', command: 'dd', description: 'delete line', category: 'combo' },
  { id: 'combo-yy', command: 'yy', description: 'yank line', category: 'combo' },
  { id: 'combo-ciw', command: 'ciw', description: 'change inner word', category: 'combo' },
  { id: 'combo-ciq', command: 'ci"', description: 'change in quotes', category: 'combo' },
  { id: 'combo-dip', command: 'di(', description: 'delete in parens', category: 'combo' },
  { id: 'combo-yyp', command: 'yyp', description: 'duplicate line', category: 'combo' },
  { id: 'combo-dap', command: 'dap', description: 'delete paragraph', category: 'combo' },
]

export const ALL_CARDS: Record<string, CardPair[]> = {
  motion: motionCards,
  operator: operatorCards,
  'text-object': textObjectCards,
  combo: comboCards,
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function selectPairs(categories: string[], count: number): CardPair[] {
  const pool: CardPair[] = []
  for (const cat of categories) {
    const cards = ALL_CARDS[cat]
    if (cards) pool.push(...cards)
  }
  const shuffled = shuffle(pool)
  return shuffled.slice(0, count)
}

/** Build a flat array of 2*count cards (each pair appears twice), shuffled. */
export function buildShuffledGrid(pairs: CardPair[]): Array<CardPair & { instanceId: string }> {
  const cards: Array<CardPair & { instanceId: string }> = []
  for (const pair of pairs) {
    cards.push({ ...pair, instanceId: `${pair.id}-cmd` })
    cards.push({ ...pair, instanceId: `${pair.id}-desc` })
  }
  return shuffle(cards)
}