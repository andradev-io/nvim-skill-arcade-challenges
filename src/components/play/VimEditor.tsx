import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import Box from '@mui/material/Box'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { getCM, Vim, vim } from '@replit/codemirror-vim'
import type { Keymap } from '../../core/keymaps'
import type { Cursor } from '../../core/types'

const CTX = { n: 'normal', v: 'visual', x: 'visual', i: 'insert' } as const

let spaceRemoved = false

/**
 * The editor answers as soon as a key matches a full command, where Vim would wait for the rest of a longer
 * mapping. So a leader of Space (built-in: move right) or comma (built-in: repeat f/t backwards) would swallow
 * every <leader> mapping. When the mappings use one of them as a prefix, the built-in is taken out of the table.
 * Space is put back for stock Vim; comma cannot be rebuilt from outside, so it stays off until the page reloads.
 */
function freeLeader(list: Keymap[]) {
  const claims = (tok: string) => list.some((m) => m.lhs.length > tok.length && m.lhs.startsWith(tok))
  if (claims('<Space>')) {
    if (!spaceRemoved) {
      Vim.unmap('<Space>', undefined as unknown as string)
      spaceRemoved = true
    }
  } else if (spaceRemoved) {
    Vim.map('<Space>', 'l', undefined as unknown as string)
  }
  if (claims(',')) Vim.unmap(',', undefined as unknown as string)
}

/** The editor keeps its mappings in one global table: set it to exactly these (none = stock Vim). */
function applyMaps(maps: Keymap[] | undefined) {
  Vim.mapclear()
  freeLeader(maps ?? [])
  for (const m of maps ?? []) {
    try {
      const add = m.noremap ? Vim.noremap : Vim.map
      add(m.lhs, m.rhs, CTX[m.mode])
    } catch {
      /* a mapping the editor rejects is simply not active */
    }
  }
}

export type VimMode = 'normal' | 'insert' | 'visual'

export interface VimEditorHandle {
  mode: () => VimMode
  text: () => string
  cursor: () => Cursor
  focus: () => void
}

interface Props {
  initialText: string
  initialCursor: Cursor
  /** Fired on every real key press, before Vim handles it. Return true to swallow the key. */
  onKey: (key: string, mode: string) => boolean
  /** Fired after the document, cursor or mode may have changed. */
  onSync: () => void
  /** Track rule "no mouse": clicks never move the cursor. */
  noMouse?: boolean
  /** Text size and height: the Play panel is compact, the Terminal can be roomier or full screen. */
  size?: keyof typeof SIZES
  /** The user's own keymaps (sandbox only). Left out, the editor is stock Vim. */
  maps?: Keymap[]
  ref: Ref<VimEditorHandle>
}

const SIZES = {
  play: {},
  terminal: { '--cm-size': '14px', '--cm-min': '240px', '--cm-max': '420px' },
  large: { '--cm-size': '17px', '--cm-min': '60vh', '--cm-max': '100%' },
  fill: { '--cm-size': '15px', '--cm-min': '0px', '--cm-max': '100%' },
} as const

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph'])
const P = 'var(--mui-palette-'

const cmTheme = EditorView.theme({
  '&': { color: `${P}text-primary)`, backgroundColor: `${P}background-paper)`, fontSize: 'var(--cm-size, 13px)' },
  '&.cm-focused': { outline: `2px solid ${P}primary-main)` },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6', maxHeight: 'var(--cm-max, 320px)' },
  '.cm-content': { padding: '10px 4px', minHeight: 'var(--cm-min, 110px)', caretColor: `${P}primary-main)` },
  '.cm-gutters': { backgroundColor: 'transparent', color: `${P}primary-main)`, border: 'none', opacity: '.7' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-fat-cursor': { background: `${P}primary-main) !important`, color: `${P}primary-contrastText) !important` },
  '&:not(.cm-focused) .cm-fat-cursor': {
    background: 'transparent !important',
    outline: `1px solid ${P}primary-main)`,
    color: 'inherit !important',
  },
  '.cm-selectionBackground': { background: `${P}primary-main) !important`, opacity: '.35' },
  '.cm-vim-panel': {
    background: `${P}background-default)`,
    color: `${P}text-primary)`,
    fontFamily: 'inherit',
    padding: '4px 10px',
  },
  '.cm-vim-panel input': {
    background: 'transparent',
    color: 'inherit',
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    width: '80%',
  },
})

/** Stock Vim emulation (CodeMirror 6 + @replit/codemirror-vim). Your own Neovim keybinds are not active here. */
export function VimEditor({ initialText, initialCursor, onKey, onSync, noMouse = false, maps, size = 'play', ref }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const hooks = useRef({ onKey, onSync })
  const lockMouse = useRef(noMouse)
  const mapsRef = useRef(maps)
  useEffect(() => {
    hooks.current = { onKey, onSync }
    lockMouse.current = noMouse
    mapsRef.current = maps
    // mappings changed while this editor is the one in use: switch to them now
    if (view.current?.hasFocus) applyMaps(maps)
  })

  useEffect(() => {
    const parent = host.current
    if (!parent) return
    const v = new EditorView({
      parent,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          vim({ status: false }),
          lineNumbers(),
          cmTheme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Vim editor for the challenge', spellcheck: 'false' }),
          EditorView.updateListener.of(() => hooks.current.onSync()),
        ],
      }),
    })
    view.current = v
    const cm = getCM(v)
    if (cm) {
      const row = Math.max(1, Math.min(v.state.doc.lines, initialCursor[0] || 1))
      const len = v.state.doc.line(row).length
      cm.setCursor(row - 1, Math.max(0, Math.min(Math.max(0, len - 1), initialCursor[1] || 0)))
      cm.on('vim-mode-change', () => hooks.current.onSync())
    }
    // some input paths (IME, automation) insert the character even after keydown was cancelled: drop it too
    let swallowed = false
    const onBeforeInput = (e: InputEvent) => {
      if (!swallowed) return
      e.preventDefault()
      swallowed = false
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (MODIFIERS.has(e.key)) return
      const vimState = cm?.state.vim
      const mode = !vimState ? 'normal' : vimState.insertMode ? 'insert' : vimState.visualMode ? 'visual' : 'normal'
      if (hooks.current.onKey(e.key, mode)) {
        // a key family this track forbids: Vim never sees it
        e.preventDefault()
        e.stopPropagation()
        swallowed = true
        setTimeout(() => {
          swallowed = false
        }, 50)
        return
      }
      setTimeout(() => hooks.current.onSync(), 0)
    }
    // a track with "no mouse": clicks may focus the editor but never move the cursor
    const onMouseDown = (e: MouseEvent) => {
      if (!lockMouse.current) return
      e.preventDefault()
      e.stopPropagation()
      v.focus()
    }
    // the table is global: whichever editor gets focus decides which mappings are live
    const onFocus = () => applyMaps(mapsRef.current)
    v.contentDOM.addEventListener('focus', onFocus)
    v.contentDOM.addEventListener('keydown', onKeyDown, true)
    v.contentDOM.addEventListener('mousedown', onMouseDown, true)
    v.contentDOM.addEventListener('beforeinput', onBeforeInput, true)
    return () => {
      v.contentDOM.removeEventListener('focus', onFocus)
      v.contentDOM.removeEventListener('beforeinput', onBeforeInput, true)
      v.contentDOM.removeEventListener('keydown', onKeyDown, true)
      v.contentDOM.removeEventListener('mousedown', onMouseDown, true)
      v.destroy()
      view.current = null
    }
    // Created once per mount: the parent remounts it (key) whenever the start buffer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    mode: () => {
      const v = view.current && getCM(view.current)?.state.vim
      return !v ? 'normal' : v.insertMode ? 'insert' : v.visualMode ? 'visual' : 'normal'
    },
    text: () => view.current?.state.doc.toString() ?? '',
    cursor: () => {
      const c = view.current && getCM(view.current)?.getCursor()
      return c ? [c.line + 1, c.ch] : [1, 0]
    },
    focus: () => view.current?.focus(),
  }))

  return (
    <Box
      ref={host}
      sx={{ border: 1, borderColor: 'primary.main', borderRadius: '15px', overflow: 'hidden', minHeight: 140, ...SIZES[size] }}
    />
  )
}
