import type { Challenge } from './core/types'

/** Ready-made drafts the author can start from. Each one passes the schema and its own replay. */
export interface Example {
  label: string
  note: string
  challenge: Challenge
}

export const EXAMPLES: Example[] = [
  {
    label: 'Change inside quotes',
    note: 'Text object, plays fully in the browser',
    challenge: {
      id: 'change-inside-quotes',
      title: 'Change inside quotes',
      area: 'textobjects',
      level: 1,
      brief: 'Replace the text inside the quotes with: new',
      text: 'name = "old value here"',
      cursor: [1, 12],
      expect: { text: 'name = "new"' },
      solution: 'ci"new<Esc>',
      why: 'ci" changes everything between the quotes from anywhere on the line, so there is no need to move first.',
    },
  },
  {
    label: 'Drop the first word',
    note: 'A motion with a count of one: df',
    challenge: {
      id: 'drop-the-first-word',
      title: 'Drop the first word',
      area: 'motions',
      level: 1,
      brief: 'Delete the first word and its comma and space, leaving: beta, gamma',
      text: 'alpha, beta, gamma',
      cursor: [1, 0],
      expect: { text: 'beta, gamma' },
      solution: 'df<Space>',
      why: 'df{char} deletes through the next {char}. dt{char} would stop before it.',
    },
  },
  {
    label: 'Swap two words',
    note: 'Delete and put, several routes work',
    challenge: {
      id: 'swap-two-words',
      title: 'Swap two words',
      area: 'editing',
      level: 2,
      brief: 'Make the line read: world hello',
      text: 'hello world',
      cursor: [1, 0],
      expect: { text: 'world hello' },
      solution: 'dwA <Esc>p',
      why: 'dw deletes a word with its space; p puts it back after the last word. Any route that ends in the same text wins.',
    },
  },
  {
    label: 'Bracket the word',
    note: 'Has a plugin tip (surround)',
    challenge: {
      id: 'bracket-the-word',
      title: 'Put the word in brackets',
      area: 'textobjects',
      level: 2,
      brief: 'Turn value into [value].',
      text: 'value',
      cursor: [1, 2],
      expect: { text: '[value]' },
      solution: 'ciw[<C-r>"]<Esc>',
      why: 'ciw deletes the word into the unnamed register; <C-r>" pastes it back while typing. A surround plugin does it in one go.',
      helps: { surround: 'one surround command wraps a word in 3-4 keys, e.g. ysiw] or saiw]' },
      plugin_par: 4,
    },
  },
  {
    label: 'One window only',
    note: 'Judged only in Neovim (windows)',
    challenge: {
      id: 'one-window-only',
      title: 'One window only',
      area: 'windows',
      level: 2,
      brief: 'Three windows are open. Close every window except the one you are in.',
      text: 'too many windows',
      cursor: [1, 0],
      expect: { windows: 1 },
      preset: 'splits',
      solution: '<C-w>o',
      why: '<C-w>o (:only) closes all other windows; <C-w>c closes just the current one.',
    },
  },
]
