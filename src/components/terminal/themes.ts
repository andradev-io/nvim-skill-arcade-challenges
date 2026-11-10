/** Color themes for the Terminal. Each becomes a set of CSS variables on the page root (see `themeVars`). */

export interface TerminalTheme {
  id: string
  name: string
  /** editor background */
  bg: string
  /** side menu */
  side: string
  /** tab line and status line */
  bar: string
  /** separators */
  line: string
  /** a segment of the status line */
  pill: string
  fg: string
  accent: string
  /** text on top of the accent color */
  onAccent: string
  warn: string
  modes: { normal: string; insert: string; visual: string }
  syn: { keyword: string; string: string; number: string; comment: string; function: string; type: string; property: string; operator: string; tag: string }
}

export const THEMES: TerminalTheme[] = [
  {
    id: 'arcade',
    name: 'Arcade',
    bg: '#0c0c0d',
    side: '#111112',
    bar: '#161617',
    line: '#232324',
    pill: '#262627',
    fg: '#dcdcdc',
    accent: '#b4b96b',
    onAccent: '#101010',
    warn: '#e8d27a',
    modes: { normal: '#b4b96b', insert: '#7fb06a', visual: '#8fa8d8' },
    syn: { keyword: '#c792ea', string: '#a5d6a7', number: '#f2a65a', comment: '#7d8590', function: '#82aaff', type: '#7fdbca', property: '#e6c07b', operator: '#9aa4b2', tag: '#f07178' },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    bg: '#1e1e2e',
    side: '#181825',
    bar: '#181825',
    line: '#313244',
    pill: '#313244',
    fg: '#cdd6f4',
    accent: '#cba6f7',
    onAccent: '#11111b',
    warn: '#f9e2af',
    modes: { normal: '#89b4fa', insert: '#a6e3a1', visual: '#cba6f7' },
    syn: { keyword: '#cba6f7', string: '#a6e3a1', number: '#fab387', comment: '#6c7086', function: '#89b4fa', type: '#f9e2af', property: '#94e2d5', operator: '#89dceb', tag: '#f38ba8' },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    bg: '#eff1f5',
    side: '#e6e9ef',
    bar: '#e6e9ef',
    line: '#ccd0da',
    pill: '#ccd0da',
    fg: '#4c4f69',
    accent: '#8839ef',
    onAccent: '#eff1f5',
    warn: '#df8e1d',
    modes: { normal: '#1e66f5', insert: '#40a02b', visual: '#8839ef' },
    syn: { keyword: '#8839ef', string: '#40a02b', number: '#fe640b', comment: '#9ca0b0', function: '#1e66f5', type: '#df8e1d', property: '#179299', operator: '#04a5e5', tag: '#d20f39' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    bg: '#282a36',
    side: '#21222c',
    bar: '#191a21',
    line: '#343746',
    pill: '#343746',
    fg: '#f8f8f2',
    accent: '#bd93f9',
    onAccent: '#282a36',
    warn: '#f1fa8c',
    modes: { normal: '#bd93f9', insert: '#50fa7b', visual: '#ff79c6' },
    syn: { keyword: '#ff79c6', string: '#f1fa8c', number: '#bd93f9', comment: '#6272a4', function: '#50fa7b', type: '#8be9fd', property: '#ffb86c', operator: '#ff79c6', tag: '#ff79c6' },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    bg: '#1a1b26',
    side: '#16161e',
    bar: '#16161e',
    line: '#292e42',
    pill: '#292e42',
    fg: '#c0caf5',
    accent: '#7aa2f7',
    onAccent: '#16161e',
    warn: '#e0af68',
    modes: { normal: '#7aa2f7', insert: '#9ece6a', visual: '#bb9af7' },
    syn: { keyword: '#bb9af7', string: '#9ece6a', number: '#ff9e64', comment: '#565f89', function: '#7aa2f7', type: '#2ac3de', property: '#73daca', operator: '#89ddff', tag: '#f7768e' },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    bg: '#282828',
    side: '#1d2021',
    bar: '#1d2021',
    line: '#3c3836',
    pill: '#3c3836',
    fg: '#ebdbb2',
    accent: '#fabd2f',
    onAccent: '#1d2021',
    warn: '#fe8019',
    modes: { normal: '#fabd2f', insert: '#b8bb26', visual: '#d3869b' },
    syn: { keyword: '#fb4934', string: '#b8bb26', number: '#d3869b', comment: '#928374', function: '#b8bb26', type: '#fabd2f', property: '#83a598', operator: '#fe8019', tag: '#fb4934' },
  },
  {
    id: 'nord',
    name: 'Nord',
    bg: '#2e3440',
    side: '#292e39',
    bar: '#272c36',
    line: '#3b4252',
    pill: '#3b4252',
    fg: '#d8dee9',
    accent: '#88c0d0',
    onAccent: '#2e3440',
    warn: '#ebcb8b',
    modes: { normal: '#88c0d0', insert: '#a3be8c', visual: '#b48ead' },
    syn: { keyword: '#81a1c1', string: '#a3be8c', number: '#b48ead', comment: '#616e88', function: '#88c0d0', type: '#8fbcbb', property: '#d8dee9', operator: '#81a1c1', tag: '#bf616a' },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    bg: '#282c34',
    side: '#21252b',
    bar: '#21252b',
    line: '#3a3f4b',
    pill: '#3a3f4b',
    fg: '#abb2bf',
    accent: '#61afef',
    onAccent: '#21252b',
    warn: '#e5c07b',
    modes: { normal: '#61afef', insert: '#98c379', visual: '#c678dd' },
    syn: { keyword: '#c678dd', string: '#98c379', number: '#d19a66', comment: '#5c6370', function: '#61afef', type: '#e5c07b', property: '#e06c75', operator: '#56b6c2', tag: '#e06c75' },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    bg: '#191724',
    side: '#1f1d2e',
    bar: '#1f1d2e',
    line: '#26233a',
    pill: '#26233a',
    fg: '#e0def4',
    accent: '#c4a7e7',
    onAccent: '#191724',
    warn: '#f6c177',
    modes: { normal: '#c4a7e7', insert: '#9ccfd8', visual: '#eb6f92' },
    syn: { keyword: '#31748f', string: '#f6c177', number: '#ebbcba', comment: '#6e6a86', function: '#ebbcba', type: '#9ccfd8', property: '#c4a7e7', operator: '#908caa', tag: '#eb6f92' },
  },
]

export const themeById = (id: string): TerminalTheme => THEMES.find((t) => t.id === id) ?? THEMES[0]

const channel = (hex: string) => `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`

/** CSS variables for a theme: our own (`--t-*`), the syntax ones, and the MUI colors the controls inside use. */
export function themeVars(t: TerminalTheme): Record<string, string> {
  return {
    '--t-bg': t.bg,
    '--t-side': t.side,
    '--t-bar': t.bar,
    '--t-line': t.line,
    '--t-pill': t.pill,
    '--t-fg': t.fg,
    '--t-accent': t.accent,
    '--t-on-accent': t.onAccent,
    '--t-warn': t.warn,
    '--t-mode-normal': t.modes.normal,
    '--t-mode-insert': t.modes.insert,
    '--t-mode-visual': t.modes.visual,
    ...Object.fromEntries(Object.entries(t.syn).map(([k, v]) => [`--t-syn-${k}`, v])),
    '--mui-palette-primary-main': t.accent,
    '--mui-palette-primary-contrastText': t.onAccent,
    '--mui-palette-text-primary': t.fg,
    '--mui-palette-text-secondary': `color-mix(in srgb, ${t.fg} 70%, transparent)`,
    '--mui-palette-background-paper': t.side,
    '--mui-palette-background-default': t.bg,
    '--mui-palette-divider': t.line,
    '--mui-palette-action-active': t.fg,
    '--mui-palette-text-disabled': `color-mix(in srgb, ${t.fg} 45%, transparent)`,
    '--mui-palette-common-onBackground': t.fg,
    '--mui-palette-common-onBackgroundChannel': channel(t.fg),
    '--mui-palette-common-backgroundChannel': channel(t.bg),
  }
}
