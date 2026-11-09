import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import { useState } from 'react'
import { isPlayable, neovimOnlyKeys } from '../../core/compare'
import type { Challenge } from '../../core/types'
import { useDraft } from '../../hooks/useDraft'
import { CodeBlock } from '../common/CodeBlock'
import { PlaySession } from './PlaySession'

function flagsFor(c: Challenge): string[] {
  const flags: string[] = []
  const others = neovimOnlyKeys(c.expect)
  if (c.needs || c.area === 'plugins' || (c.helps && Object.keys(c.helps).length)) {
    flags.push('Plugin-specific challenge: your plugins are not simulated here. Only the stock-Vim route can be played; check the plugin route in Neovim.')
  }
  if (others.length) flags.push(`Not checkable in the browser: ${others.join(', ')}. They are only judged in Neovim.`)
  if (c.preset) flags.push(`Preset '${c.preset}' (diagnostics, windows, quickfix ...) is not created here.`)
  return flags
}

function expectedText(c: Challenge): string {
  const e = c.expect
  const cur = e.cursor ? `-- cursor: row ${e.cursor[0]}${e.cursor[1] !== undefined ? `, col ${e.cursor[1]}` : ''}` : ''
  return (e.text !== undefined ? e.text : '(no text expectation)') + (cur ? `\n\n${cur}` : '')
}

export function PlayPanel() {
  const { data } = useDraft()
  const [run, setRun] = useState(0)
  const [expectedOpen, setExpectedOpen] = useState(false)
  const playable = isPlayable(data)
  // a new start buffer or cursor, or Reset, starts a fresh round with a fresh editor
  const roundKey = `${run}|${data.text}|${data.cursor.join(',')}`

  return (
    <Stack spacing={1.5}>
      <Alert severity="info" variant="outlined">
        Stock Vim emulation in the browser, not your Neovim: your own keybinds and plugins are <b>not</b> active here, and
        some keys (windows, quickfix, :g with ranges, registers beyond the basics) may behave slightly differently. Use
        <b> Join in Neovim</b> below for the real thing.
      </Alert>
      {flagsFor(data).map((f) => (
        <Alert key={f} severity="warning" variant="outlined">
          {f}
        </Alert>
      ))}
      {playable ? (
        <PlaySession
          key={roundKey}
          draft={data}
          onReset={() => setRun((n) => n + 1)}
          expectedOpen={expectedOpen}
          onToggleExpected={() => setExpectedOpen((o) => !o)}
        />
      ) : (
        <Alert severity="info">
          {data.text
            ? 'This challenge has no text or cursor expectation, so it is judged only in Neovim. Use the Neovim tab to play it.'
            : 'Add start text and an expected text or cursor to play here. Other assertions only run in Neovim.'}
        </Alert>
      )}
      {expectedOpen && <CodeBlock label="Expected end state">{expectedText(data)}</CodeBlock>}
    </Stack>
  )
}
