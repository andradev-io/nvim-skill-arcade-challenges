import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import Box from '@mui/material/Box'
import { history } from '@codemirror/commands'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, gutter, GutterMarker } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { getCM, Vim, vim } from '@replit/codemirror-vim'
import type { Keymap } from '../../core/keymaps'
import { pendingText } from '../../core/terminalUx'
import type { VimInput } from '../../core/terminalUx'
import type { Cursor } from '../../core/types'
import { buildJumpDecorations, type JumpTarget } from '../../plugins/jumpLabels'
import { applyShims, handleShimKey, setFiletype, setJumpTargets, getJumpState, isSurroundAwaiting, setLspData, setLspHoverCallbacks } from '../../plugins/vimGlue'
import type { Cm } from '../../plugins/vimGlue'
import { hoverField, dispatchHover, clearHover } from '../../plugins/lsp/hoverTooltip'
import { buildDiagnosticDecorations } from '../../plugins/lsp/diagnostics'
import type { LspConfig } from '../../core/types'
import { whichKeyStep, initialWhichKeyState } from '../../core/whichKey'
import type { WhichKeyConfig, WhichKeyState } from '../../core/whichKey'
import { installExCommands, stubNotes } from './exCommands'
import { highlighting, loadLanguage } from './languages'

installExCommands()

/** Relative line number gutter marker: shows absolute number on cursor line, offset on others. */
class RelativeLineMarker extends GutterMarker {
  constructor(private readonly text: string) { super() }
  toDOM() {
    return document.createTextNode(this.text)
  }
  eq(other: RelativeLineMarker) { return this.text === other.text }
}

/** Custom gutter that displays relative line numbers (absolute on cursor line, offsets elsewhere). */
const relativeLineNumbers = gutter({
  class: 'cm-relative-line-numbers',
  renderEmptyElements: false,
  markers(view) {
    const builder = new RangeSetBuilder<RelativeLineMarker>()
    const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number
    for (const range of view.visibleRanges) {
      let pos = range.from
      while (pos <= range.to) {
        const line = view.state.doc.lineAt(pos)
        const offset = Math.abs(line.number - cursorLine)
        const text = offset === 0 ? String(line.number) : String(offset)
        builder.add(line.from, line.from, new RelativeLineMarker(text))
        pos = line.to + 1
      }
    }
    return builder.finish()
  },
  initialSpacer() { return new RelativeLineMarker('0') },
})

const CTX = { n: 'normal', v: 'visual', x: 'visual', i: 'insert' } as const

/**
 * The editor answers as soon as a key matches a full command, where Vim would wait for the rest of a longer
 * mapping. So a leader of Space (built-in: move right) or comma (built-in: repeat f/t backwards) would swallow
 * every <leader> mapping. When the mappings use one of them as a prefix, the built-in is taken out of the table.
 * Space is put back for stock Vim; comma cannot be rebuilt from outside, so it stays off until the page reloads.
 *
 * `spaceRemoved` tracks whether we have unmapped Space globally. It lives at module scope because
 * Vim's mapping table is global — there is only one table regardless of how many VimEditor instances exist.
 * Each instance calls freeLeader on focus; the flag prevents redundant unmap/map calls.
 */
let spaceRemoved = false

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
const NO_PLUGINS: ReadonlySet<string> = new Set()

function applyMaps(maps: Keymap[] | undefined, plugins: ReadonlySet<string> = NO_PLUGINS) {
  Vim.mapclear()
  stubNotes.length = 0
  freeLeader(maps ?? [])
  applyShims(plugins)
  for (const m of maps ?? []) {
    try {
      if (m.note) {
        // a key that needs a plugin: take the key over (it must not fall through to a stock key) and say so when pressed
        if (m.mode !== 'i') Vim.noremap(m.lhs, `:arcnote ${stubNotes.push(m.note) - 1}<CR>`, CTX[m.mode])
        continue
      }
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
  setCursor: (pos: { line: number; ch: number }) => void
  focus: () => void
  /** What Vim is waiting for (`"a2d`), empty when nothing is pending. */
  pending: () => string
  /** The register being recorded into, or null. */
  recording: () => string | null
/** Named marks set via `m{a-z}`: mark name -> line number (1-based). */
  marks: () => Record<string, number>
  /** Current which-key overlay state, or null when inactive. */
  whichKeyState: () => WhichKeyState | null
}

interface VimInternals {
  inputState?: VimInput
  macroModeState?: { isRecording?: boolean; latestRegister?: string | null }
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
  /** Plugin imitations to switch on (ids from the plugin registry). */
  plugins?: ReadonlySet<string>
  /** Filetype, for the comment plugin. */
  filetype?: string
  /** Pre-computed jump targets for label-based motion simulation. */
  jumpTargets?: JumpTarget[]
  /** Which-key overlay configuration (from challenge data or user keymaps). */
  whichKeyConfig?: WhichKeyConfig | null
  /** LSP simulation configuration (hover, go-to-definition, diagnostics). */
  lspConfig?: LspConfig
  ref: Ref<VimEditorHandle>
}

const SIZES = {
  play: {},
  terminal: { '--cm-size': '14px', '--cm-min': '240px', '--cm-max': '420px' },
  large: { '--cm-size': '17px', '--cm-min': '60vh', '--cm-max': '100%' },
  fill: { '--cm-size': '15px', '--cm-min': '0px', '--cm-max': '100%' },
} as const

/** Syntax colors: light by default, brighter ones under the dark theme (the Terminal is always dark). */
const SYNTAX = {
  '.dark &': {
    '--syn-keyword': '#c792ea',
    '--syn-string': '#a5d6a7',
    '--syn-number': '#f2a65a',
    '--syn-comment': '#7d8590',
    '--syn-function': '#82aaff',
    '--syn-type': '#7fdbca',
    '--syn-property': '#e6c07b',
    '--syn-operator': '#9aa4b2',
    '--syn-tag': '#f07178',
    '--syn-meta': '#9aa4b2',
    '--syn-invalid': '#f07178',
  },
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
  '.cm-selectionBackground': { background: `${P}primary-main) !important`, opacity: '.5' },
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
  '.cm-jump-target': { position: 'relative' },
  '.cm-jump-target::after': {
    content: 'attr(data-jump-label)',
    position: 'absolute',
    left: '0',
    top: '-0.2em',
    background: '#e65100',
    color: '#fff',
    fontSize: '0.75em',
    fontWeight: 'bold',
    padding: '0 2px',
    borderRadius: '2px',
    lineHeight: '1.2',
    zIndex: '10',
    pointerEvents: 'none',
  },
  '&.dark .cm-jump-target::after': { background: '#ff6d00' },
})

/** Stock Vim emulation (CodeMirror 6 + @replit/codemirror-vim). Your own Neovim keybinds are not active here. */
export function VimEditor({ initialText, initialCursor, onKey, onSync, noMouse = false, maps, plugins, filetype = 'text', size = 'play', jumpTargets, whichKeyConfig, lspConfig, ref }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const hooks = useRef({ onKey, onSync })
  const lockMouse = useRef(noMouse)
  const mapsRef = useRef(maps)
  const filetypeRef = useRef(filetype)
  const lang = useRef(new Compartment())
  const jumpDeco = useRef(new Compartment())
  const lspDeco = useRef(new Compartment())
  const pluginsRef = useRef<ReadonlySet<string>>(plugins ?? NO_PLUGINS)
  const jumpTargetsRef = useRef(jumpTargets)
  const lspConfigRef = useRef<LspConfig | undefined>(undefined)
  const wkConfigRef = useRef<WhichKeyConfig | null>(whichKeyConfig ?? null)
  const wkStateRef = useRef<WhichKeyState>(initialWhichKeyState())
  const wkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [_wkState, setWkState] = useState<WhichKeyState>(initialWhichKeyState())
  // Runs on every render (no dependency array) by design: this effect keeps refs in sync
  // with the latest props so that event handlers attached once in the mount-only effect below
  // always call the current callbacks. Adding a dependency array would defeat the purpose —
  // we need the refs updated even when only a callback identity changes. The side effects
  // here (setFiletype, setJumpTargets, setLspData, applyMaps) are idempotent and cheap.
  useEffect(() => {
    hooks.current = { onKey, onSync }
    lockMouse.current = noMouse
    mapsRef.current = maps
    pluginsRef.current = plugins ?? NO_PLUGINS
    filetypeRef.current = filetype
    jumpTargetsRef.current = jumpTargets
    wkConfigRef.current = whichKeyConfig ?? null
    lspConfigRef.current = lspConfig
    setFiletype(filetype)
    setJumpTargets(jumpTargets ?? [])
    setLspData(lspConfig)
    // mappings changed while this editor is the one in use: switch to them now
    if (view.current?.hasFocus) applyMaps(maps, pluginsRef.current)
  }) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: runs every render to sync refs

  useEffect(() => {
    const parent = host.current
    if (!parent) return
    const v = new EditorView({
      parent,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          history(),
          highlighting,
          lang.current.of([]),
          jumpDeco.current.of([]),
          lspDeco.current.of([]),
          hoverField,
          vim({ status: false }),
          relativeLineNumbers,
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
    // Wire LSP hover callbacks so handleShimKey can dispatch tooltips via the view
    setLspHoverCallbacks(
      (pos: number, text: string) => dispatchHover(v, pos, text),
      () => clearHover(v),
    )
    // some input paths (IME, automation) insert the character even after keydown was cancelled: drop it too
    let swallowed = false
    const onBeforeInput = (e: InputEvent) => {
      if (!swallowed) return
      e.preventDefault()
      swallowed = false
    }
    const dispatchWk = (action: import('../../core/whichKey').WhichKeyAction) => {
      const cfg = wkConfigRef.current
      if (!cfg) return
      const next = whichKeyStep(cfg, wkStateRef.current, action)
      wkStateRef.current = next
      setWkState(next)
    }
    const clearWkTimer = () => {
      if (wkTimerRef.current !== null) {
        clearTimeout(wkTimerRef.current)
        wkTimerRef.current = null
      }
    }
    const startWkTimer = () => {
      clearWkTimer()
      const cfg = wkConfigRef.current
      if (!cfg) return
      wkTimerRef.current = setTimeout(() => {
        dispatchWk({ type: 'timeout' })
      }, cfg.timeoutMs)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (MODIFIERS.has(e.key)) return
      const vimState = cm?.state.vim
      const mode = !vimState ? 'normal' : vimState.insertMode ? 'insert' : vimState.visualMode ? 'visual' : 'normal'

      // Non-interference: reset which-key in insert/visual mode or when shim states are active
      if (mode !== 'normal' || isSurroundAwaiting() || getJumpState() !== null) {
        dispatchWk({ type: 'reset' })
        clearWkTimer()
      }

      if (pluginsRef.current.size && cm && handleShimKey(e, cm as unknown as Cm, pluginsRef.current)) {
        // a key a plugin imitation took (gcc, ys, ds, auto pairs, jump motion ...)
        dispatchWk({ type: 'reset' })
        clearWkTimer()
        e.preventDefault()
        e.stopPropagation()
        swallowed = true
        // refresh jump decorations if jump state is active
        const js = getJumpState()
        if (js && v) {
          // DecorationSet is not assignable to Extension in CodeMirror's type system, but Compartment.reconfigure accepts it at runtime.
          v.dispatch({ effects: jumpDeco.current.reconfigure(buildJumpDecorations(v, jumpTargetsRef.current ?? [], js.typed) as unknown as Extension) })
        } else if (v) {
          v.dispatch({ effects: jumpDeco.current.reconfigure([]) })
        }
        setTimeout(() => {
          swallowed = false
          hooks.current.onSync()
        }, 50)
        return
      }

      // Which-key processing: after shim handling, before onKey callback
      if (mode === 'normal' && wkConfigRef.current && !isSurroundAwaiting() && !getJumpState()) {
        const prevState = wkStateRef.current
        dispatchWk({ type: 'keydown', key: e.key })
        const nextState = wkStateRef.current
        // If overlay was visible and key matched an entry, dismiss (key passes through to Vim)
        if (prevState.visible && !nextState.visible) {
          clearWkTimer()
          // Key consumed by which-key match: let it fall through to Vim
        } else if (nextState.node && !nextState.visible) {
          // Prefix detected but not yet visible: start/reset timer
          startWkTimer()
        } else if (!nextState.node) {
          // No prefix match: clear timer
          clearWkTimer()
        }
      }

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
    const onFocus = () => {
      setFiletype(filetypeRef.current)
      applyMaps(mapsRef.current, pluginsRef.current)
    }
    v.contentDOM.addEventListener('focus', onFocus)
    v.contentDOM.addEventListener('keydown', onKeyDown, true)
    v.contentDOM.addEventListener('mousedown', onMouseDown, true)
    v.contentDOM.addEventListener('beforeinput', onBeforeInput, true)
    return () => {
      clearWkTimer()
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

  // syntax highlighting follows the filetype; the parser loads on demand
  useEffect(() => {
    let live = true
    void loadLanguage(filetype).then((ext) => {
      if (live && view.current) view.current.dispatch({ effects: lang.current.reconfigure(ext ?? []) })
    })
    return () => {
      live = false
    }
  }, [filetype])

  // LSP diagnostic decorations update when lspConfig changes
  useEffect(() => {
    const v = view.current
    if (!v) return
    const diags = lspConfig?.diagnostics
    if (diags && diags.length > 0) {
      // DecorationSet is not assignable to Extension in CodeMirror's type system, but Compartment.reconfigure accepts it at runtime.
      v.dispatch({ effects: lspDeco.current.reconfigure(buildDiagnosticDecorations(v, diags) as unknown as Extension) })
    } else {
      v.dispatch({ effects: lspDeco.current.reconfigure([]) })
    }
  }, [lspConfig])

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
    setCursor: (pos) => {
      const cm = view.current && getCM(view.current)
      if (cm) cm.setCursor(pos.line, pos.ch)
    },
    focus: () => view.current?.focus(),
    pending: () => pendingText(((view.current && getCM(view.current)?.state.vim) as VimInternals | undefined)?.inputState),
    recording: () => {
      const m = ((view.current && getCM(view.current)?.state.vim) as VimInternals | undefined)?.macroModeState
      return m?.isRecording ? (m.latestRegister ?? '?') : null
    },
marks: () => {
      const v = view.current && getCM(view.current)?.state.vim as (VimInternals & { marks?: Record<string, { line: number }> }) | undefined
      const raw = v?.marks
      if (!raw) return {}
      const out: Record<string, number> = {}
      for (const [k, pos] of Object.entries(raw)) {
        if (/^[a-z]$/.test(k) && pos && typeof pos.line === 'number') out[k] = pos.line + 1
      }
      return out
    },
    whichKeyState: () => {
      const s = wkStateRef.current
      return s.node ? s : null
    },
  }))

  return (
    <Box
      ref={host}
      sx={{ border: 1, borderColor: 'primary.main', borderRadius: '15px', overflow: 'hidden', minHeight: 140, ...SYNTAX, ...SIZES[size] }}
    />
  )
}
