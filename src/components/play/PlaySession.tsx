import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useRef } from 'react'
import { keyRank } from '../../core/keys'
import { parOf } from '../../core/schema'
import { rulesLine } from '../../core/track'
import type { Challenge } from '../../core/types'
import { usePlay } from '../../hooks/usePlay'
import { VimEditor } from './VimEditor'
import type { VimEditorHandle } from './VimEditor'

function detailText(draft: Challenge, keys: number, mode: string, miss: string[], passed: { keys: number; secs: number } | null, cp: number) {
  const par = parOf(draft)
  if (passed) {
    const rank = par ? ` (par ${par} keys, key rank ${keyRank(passed.keys, par)})` : ''
    return `Solved in ${passed.keys} keys and ${passed.secs.toFixed(1)}s${rank}. Reset to try another route.`
  }
  if (keys === 0) return 'Click the editor and play. The clock starts on your first key.'
  if (mode !== 'normal' && miss.length === 0) {
    return `State matches, but you are in ${mode} mode: press Esc (the game also needs normal mode).`
  }
  const total = draft.track?.checkpoints?.length ?? 0
  if (draft.track && cp < total) return `Touch checkpoint ${cp + 1} of ${total} next (in order), then reach the goal.`
  if (draft.track) return miss.includes('text') ? 'The map was changed: a track must stay untouched.' : 'Checkpoints done: now the cursor must land on the goal.'
  return `Not there yet: ${miss.join(' and ')} differ${miss.length === 1 ? 's' : ''}.`
}

interface Props {
  draft: Challenge
  onReset: () => void
  onToggleExpected: () => void
  expectedOpen: boolean
}

/** One play round. Remounted (by key) whenever the start buffer changes or Reset is pressed. */
export function PlaySession({ draft, onReset, onToggleExpected, expectedOpen }: Props) {
  const editor = useRef<VimEditorHandle>(null)
  const { state, onKey, onSync } = usePlay(draft, editor)
  const par = parOf(draft)
  const track = draft.track
  const total = track?.checkpoints?.length ?? 0
  const rules = track ? rulesLine(track) : ''
  const done = state.passed
  const keys = done ? done.keys : state.keys
  const rank = par && done ? ` (${keyRank(keys, par)})` : ''
  const badge = done ? { label: 'PASS', color: 'success' as const } : state.t0 !== null
    ? { label: 'playing', color: 'info' as const }
    : { label: 'ready', color: 'default' as const }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", gap: 1.5 }} aria-live="polite">
        <Chip size="small" variant={done ? 'filled' : 'outlined'} color={badge.color} label={badge.label} />
        <Typography variant="body2">
          keys {keys} / par {par || '-'}
          {rank}
        </Typography>
        <Typography variant="body2">{(done ? done.secs : state.elapsed).toFixed(1)}s</Typography>
        <Typography variant="body2" color="text.secondary">{state.mode}</Typography>
        {track && (
          <Typography variant="body2" color="text.secondary">
            {total > 0 ? `checkpoints ${Math.min(state.cp, total)}/${total}` : 'reach the goal'}
            {rules ? ` · ${rules}` : ''}
          </Typography>
        )}
      </Stack>
      <VimEditor
        ref={editor}
        initialText={draft.text}
        initialCursor={draft.cursor}
        onKey={onKey}
        onSync={onSync}
        noMouse={!!track?.forbid?.includes('mouse')}
      />
      <Typography variant="caption" color="text.secondary">
        {state.blocked && !done ? `This track forbids '${state.blocked}'. ` : ''}
        {detailText(draft, state.keys, state.mode, state.miss, done, state.cp)}
      </Typography>
      <Stack direction="row" sx={{ gap: 1 }}>
        <Button variant="outlined" onClick={onReset}>
          Reset
        </Button>
        <Button variant="outlined" onClick={onToggleExpected} aria-expanded={expectedOpen}>
          {expectedOpen ? 'Hide expected' : 'Show expected'}
        </Button>
      </Stack>
    </Stack>
  )
}
