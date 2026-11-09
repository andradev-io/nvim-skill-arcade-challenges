import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useMemo } from 'react'
import { check, linesEqual, neovimOnlyKeys } from '../../core/compare'
import { keyCount } from '../../core/keys'
import { replay } from '../../core/replay'
import type { ReplayResult } from '../../core/replay'
import { checkpointsReached, judgeTrack } from '../../core/track'
import type { Challenge, Cursor, Track } from '../../core/types'
import { useDraft } from '../../hooks/useDraft'
import { CodeBlock } from '../common/CodeBlock'

type Severity = 'success' | 'error' | 'info'
interface Verdict {
  severity: Severity
  tag: string
  msg: string
}

const withCursor = (text: string, cur: Cursor): string =>
  text
    .split('\n')
    .map((l, i) => (i === cur[0] - 1 ? `${l}   <- cursor ${cur[0]},${cur[1]}` : l))
    .join('\n')

function expectedView(c: Challenge): string {
  if (c.track) {
    const cps = (c.track.checkpoints ?? []).map(([r, k]) => `${r},${k}`).join(' -> ')
    return `-- goal: ${c.track.goal.join(',')}${cps ? `\n-- checkpoints in order: ${cps}` : ''}\n-- the map must stay untouched`
  }
  const e = c.expect
  if (e.text !== undefined) return e.text + (e.cursor ? `\n\n-- cursor: ${e.cursor.join(',')}` : '')
  return e.cursor ? `-- cursor: ${e.cursor.join(',')}` : '(no text expectation)'
}

function analyseTrack(c: Challenge, t: Track, rep: ReplayResult, verdicts: Verdict[]): { verdicts: Verdict[]; replayed: string } {
  if (rep.unsupported) {
    verdicts.push({ severity: 'info', tag: 'replay', msg: `Cannot preview '${rep.unsupported}' here. That is fine: use Join in Neovim to be sure.` })
    return { verdicts, replayed: `(stopped at ${rep.unsupported})` }
  }
  if (rep.blocked) {
    verdicts.push({ severity: 'error', tag: 'rules', msg: `The reference keys use '${rep.blocked}', which this track forbids.` })
  }
  const reached = checkpointsReached(t, rep.visited)
  const v = judgeTrack(t, reached, rep.cursor, linesEqual(c.text, rep.text, false))
  if (v.solved) {
    verdicts.push({ severity: 'success', tag: 'replay', msg: `Reference keys reach the goal${v.total ? ` through ${v.total} checkpoint${v.total > 1 ? 's' : ''} in order` : ''} (${keyCount(c.solution)} keys).` })
  } else if (reached < v.total) {
    verdicts.push({ severity: 'error', tag: 'replay', msg: `Reference keys reach only ${reached} of ${v.total} checkpoints in order.` })
  } else if (rep.cursor[0] !== t.goal[0] || rep.cursor[1] !== t.goal[1]) {
    verdicts.push({ severity: 'error', tag: 'replay', msg: `Reference keys end at ${rep.cursor[0]},${rep.cursor[1]}, not on the goal ${t.goal[0]},${t.goal[1]}.` })
  } else {
    verdicts.push({ severity: 'error', tag: 'replay', msg: 'Reference keys changed the map. A track must stay untouched.' })
  }
  return { verdicts, replayed: withCursor(rep.text, rep.cursor) }
}

function analyse(c: Challenge): { verdicts: Verdict[]; replayed: string } {
  const e = c.expect
  const verdicts: Verdict[] = []
  if (!Object.keys(e).length || !c.text) {
    return { verdicts: [{ severity: 'info', tag: 'wait', msg: 'Fill the start buffer and an expected end state to run the check.' }], replayed: '' }
  }
  const others = neovimOnlyKeys(e)
  if (others.length) {
    verdicts.push({ severity: 'info', tag: 'note', msg: `Also checked, but only in Neovim: ${others.join(', ')}. Use Join in Neovim for those.` })
  }
  if (e.text === undefined && !e.cursor) return { verdicts, replayed: '' }

  const expectPart = { text: e.text, cursor: e.cursor }
  const at0 = check(expectPart, { text: c.text, cursor: c.cursor }, false)
  if (e.text !== undefined && linesEqual(c.text, e.text, false) && !e.cursor) {
    verdicts.push({ severity: 'error', tag: 'start', msg: 'The start buffer already equals the expected text: nothing to do.' })
  } else if (at0.ok && others.length === 0 && !c.track?.checkpoints?.length) {
    verdicts.push({ severity: 'error', tag: 'start', msg: 'Already solved at the start. CI rejects that: change the start or the expected state.' })
  } else {
    verdicts.push({ severity: 'success', tag: 'start', msg: 'Not solved at the start, good.' })
  }
  if (!c.solution) return { verdicts, replayed: '' }

  const rep = replay(c.text, c.cursor, c.solution, c.track?.forbid)
  if (c.track) return analyseTrack(c, c.track, rep, verdicts)
  if (rep.unsupported) {
    verdicts.push({ severity: 'info', tag: 'replay', msg: `Cannot preview '${rep.unsupported}' here. That is fine: use Join in Neovim to be sure.` })
    return { verdicts, replayed: `(stopped at ${rep.unsupported})` }
  }
  const chk = check(expectPart, rep, !!c.loose)
  if (others.length) {
    verdicts.push({ severity: 'info', tag: 'replay', msg: `Text/cursor part: ${chk.ok ? 'reached' : 'not reached'} by the reference keys.` })
  } else if (chk.ok) {
    verdicts.push({ severity: 'success', tag: 'replay', msg: `Reference keys reach the expected state (${keyCount(c.solution)} keys).` })
  } else {
    const which = chk.parts.filter((p) => !p.ok).map((p) => p.name).join(' and ')
    verdicts.push({ severity: 'error', tag: 'replay', msg: `Reference keys do not reach the expected ${which}. Compare the buffers below (the preview is approximate).` })
  }
  return { verdicts, replayed: withCursor(rep.text, rep.cursor) }
}

export function SimCheck() {
  const { data } = useDraft()
  const { verdicts, replayed } = useMemo(() => analyse(data), [data])
  return (
    <Stack spacing={1.5}>
      <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
        Replays your reference keys on the start buffer with a small approximate interpreter (common normal-mode keys only).
        Neovim and the CI replay are the authority.
      </Box>
      {verdicts.map((v) => (
        <Alert key={v.tag + v.msg} severity={v.severity} variant="outlined" sx={{ py: 0 }}>
          <b>{v.tag}</b> {v.msg}
        </Alert>
      ))}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <CodeBlock label="Start" maxHeight={200}>{withCursor(data.text, data.cursor)}</CodeBlock>
        <CodeBlock label="Expected" maxHeight={200}>{expectedView(data)}</CodeBlock>
      </Box>
      <CodeBlock label="Reference keys replayed here" maxHeight={200}>{replayed}</CodeBlock>
    </Stack>
  )
}
