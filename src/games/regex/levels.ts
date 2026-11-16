import type { RegexLevel } from './types'

export const REGEX_LEVELS: RegexLevel[] = [
  {
    id: 'exact-match',
    name: 'Exact Match',
    parSeconds: 45,
    maxAttemptsPerPuzzle: 5,
    allowedFeatures: ['literal'],
    hints: [
      'Type the exact characters you see highlighted.',
      'Remember: the pattern must match ALL highlighted regions and nothing else.',
    ],
    puzzles: [
      {
        bufferLines: ['hello world', 'goodbye world'],
        targets: [
          { line: 0, startCol: 0, endCol: 5 },
        ],
        feature: 'literal',
      },
      {
        bufferLines: ['foo bar baz', 'foo qux foo'],
        targets: [
          { line: 0, startCol: 0, endCol: 3 },
          { line: 1, startCol: 0, endCol: 3 },
          { line: 1, startCol: 8, endCol: 11 },
        ],
        feature: 'literal',
      },
      {
        bufferLines: ['abc def ghi', 'jkl abc mno'],
        targets: [
          { line: 0, startCol: 4, endCol: 7 },
          { line: 1, startCol: 4, endCol: 7 },
        ],
        feature: 'literal',
      },
    ],
  },
  {
    id: 'character-classes',
    name: 'Character Classes',
    parSeconds: 60,
    maxAttemptsPerPuzzle: 5,
    allowedFeatures: ['literal', 'character-class'],
    hints: [
      'Use [abc] to match any one of a, b, or c.',
      'Use \\d to match any digit, \\w for word characters.',
      'Ranges work inside brackets: [a-z] matches lowercase letters.',
    ],
    puzzles: [
      {
        bufferLines: ['cat bat hat', 'dog log fog'],
        targets: [
          { line: 0, startCol: 0, endCol: 3 },
          { line: 0, startCol: 4, endCol: 7 },
          { line: 0, startCol: 8, endCol: 11 },
        ],
        feature: 'character-class',
      },
      {
        bufferLines: ['item1 item2 itemA', 'value9 value0 valueX'],
        targets: [
          { line: 0, startCol: 4, endCol: 5 },
          { line: 0, startCol: 10, endCol: 11 },
          { line: 1, startCol: 5, endCol: 6 },
          { line: 1, startCol: 12, endCol: 13 },
        ],
        feature: 'character-class',
      },
    ],
  },
  {
    id: 'quantifiers-anchors',
    name: 'Quantifiers & Anchors',
    parSeconds: 90,
    maxAttemptsPerPuzzle: 6,
    allowedFeatures: ['literal', 'character-class', 'quantifier', 'anchor'],
    hints: [
      '* matches zero or more, + matches one or more.',
      '^ matches start of line, $ matches end of line.',
      'Combine anchors with patterns: ^foo matches "foo" only at line start.',
      'Use . to match any single character.',
    ],
    puzzles: [
      {
        bufferLines: ['aaa bbb ccc', 'aa bb cc'],
        targets: [
          { line: 0, startCol: 0, endCol: 3 },
          { line: 0, startCol: 4, endCol: 7 },
          { line: 0, startCol: 8, endCol: 11 },
          { line: 1, startCol: 0, endCol: 2 },
          { line: 1, startCol: 3, endCol: 5 },
          { line: 1, startCol: 6, endCol: 8 },
        ],
        feature: 'quantifier',
      },
      {
        bufferLines: ['start middle end', 'begin finish'],
        targets: [
          { line: 0, startCol: 0, endCol: 5 },
          { line: 1, startCol: 0, endCol: 5 },
        ],
        feature: 'anchor',
      },
    ],
  },
]