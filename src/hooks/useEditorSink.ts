import { useEffect, useRef } from 'react'
import type { VimEditorHandle } from '../components/play/VimEditor'
import { setEditorSink } from '../components/play/exCommands'
import { useTerminalStore } from '../store/terminalStore'
import type { PickerConfig } from '../core/types'

interface EditorSinkActions {
  say: (text: string) => void
  revealHint: () => void
  retry: () => void
  goNext: () => void
}

interface EditorSinkOptions {
  editor: React.RefObject<VimEditorHandle | null>
  actions: React.MutableRefObject<EditorSinkActions>
  judged: { picker?: PickerConfig } | null
  setPickerConfig: (cfg: PickerConfig) => void
  setPickerOpen: (open: boolean) => void
  setPalette: (open: boolean) => void
  noteTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>
}

/**
 * Wires the editor's ex-command sink so that commands the editor cannot handle
 * itself (tabs, buffers, messages) come back to the page.
 * The sink is stable: it always calls the latest handlers via the actions ref.
 */
export function useEditorSink({ editor, actions, judged, setPickerConfig, setPickerOpen, setPalette, noteTimer }: EditorSinkOptions) {
  // keep a stable ref to the latest options so the effect closure never goes stale
  const opts = useRef({ judged, setPickerConfig, setPickerOpen, setPalette })
  opts.current = { judged, setPickerConfig, setPickerOpen, setPalette }

  useEffect(() => {
    const t = useTerminalStore.getState
    setEditorSink({
      note: (text) => actions.current.say(text),
      tab: (action) => {
        // keep the text of the tab we are leaving
        const ed = editor.current
        if (ed) t().save(ed.text(), ed.cursor())
        if (action === 'new') t().newTab()
        else if (action === 'close') t().closeTab()
        else t().stepTab(action === 'next' ? 1 : -1)
      },
      action: (name) => {
        if (name === 'retry') actions.current.retry()
        // (retry, hint and next judge the buffer open right now)
        else if (name === 'hint') actions.current.revealHint()
        else if (name === 'next') actions.current.goNext()
        else if (name.startsWith('picker:')) {
          const cfg = opts.current.judged?.picker
          if (cfg) {
            opts.current.setPickerConfig(cfg)
            opts.current.setPickerOpen(true)
          } else {
            actions.current.say('No picker configured for this challenge')
          }
        } else opts.current.setPalette(true)
      },
    })
    return () => {
      setEditorSink({})
      clearTimeout(noteTimer.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: the sink reads everything through refs
}