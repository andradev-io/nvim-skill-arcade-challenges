import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import type { PlayState } from '../../hooks/usePlay'
import { useClipboard } from '../../hooks/useClipboard'
import type { BuiltinChallenge } from '../../core/builtin'
import { scoreIdOf } from '../../core/builtin'
import { efficiency, hintSteps, lineDiff, resultText, stars } from '../../core/terminalUx'
import { submitScore } from '../../auth/api'
import { accessToken, useAuthStore } from '../../auth/authStore'
import { authConfig } from '../../auth/config'

type Save = 'idle' | 'saving' | 'saved' | 'error'

/** Sends the finished result to the score service when someone is signed in. Anonymous play is never sent. */
function useSaveResult(challenge: BuiltinChallenge, passed: PlayState['passed']): { save: Save; error: string } {
  const status = useAuthStore((s) => s.status)
  // the outcome belongs to one finished attempt: a new attempt (another `passed` object) starts from "saving"
  const [done, setDone] = useState<{ for: PlayState['passed']; save: Save; error: string } | null>(null)
  const setState = (v: { save: Save; error: string }) => setDone({ for: passed, ...v })
  useEffect(() => {
    if (!passed || status !== 'in' || !authConfig) return
    let live = true
    const result = { challenge: scoreIdOf(challenge.id), keys: Math.max(1, passed.keys), ms: Math.max(200, Math.round(passed.secs * 1000)) }
    accessToken()
      .then((token) => {
        if (!token) throw new Error('Your session expired. Sign in again to save results.')
        return submitScore(authConfig!.api, token, result)
      })
      .then(() => live && setState({ save: 'saved', error: '' }))
      .catch((e: unknown) => live && setState({ save: 'error', error: e instanceof Error ? e.message : 'Could not save the result.' }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passed, status, challenge.id])
  if (!passed) return { save: 'idle', error: '' }
  if (done && done.for === passed) return { save: done.save, error: done.error }
  return { save: status === 'in' && authConfig ? 'saving' : 'idle', error: '' }
}

const fmt = (secs: number) => `${secs.toFixed(1)}s`
const SITE = 'https://arcade.nvim.andradev.io/#/terminal'

export interface ChallengeBarProps {
  challenge: BuiltinChallenge
  state: PlayState
  /** The text the buffer holds now (for the diff). */
  actual: string
  /** How many hints are showing (0-3). */
  hints: number
  onHint: () => void
  onRetry: () => void
  /** Null when there is no next challenge. */
  onNext: (() => void) | null
  /** Fewest keys this session for this challenge, if it was solved before. */
  best?: number
}

/** The brief of a built-in challenge opened in the Terminal, its live key count, hints, a diff, and the result once it is solved. */
export function ChallengeBar({ challenge, state, actual, hints, onHint, onRetry, onNext, best }: ChallengeBarProps) {
  const { save, error } = useSaveResult(challenge, state.passed)
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
  const { copy, copied } = useClipboard()
  const par = challenge.par_keys
  const [showWhy, setShowWhy] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const p = state.passed
  const steps = useMemo(() => hintSteps(challenge), [challenge])
  const expected = challenge.expect?.text
  const diff = useMemo(() => (showDiff && expected !== undefined ? lineDiff(actual, expected, !!challenge.loose) : []), [showDiff, actual, expected, challenge.loose])
  const stuck = !p && state.keys > 0 && state.miss.length > 0 && state.mode === 'normal'
  const over = !!par && state.keys > par
  const star = p ? stars(p.keys, par) : 0
  const atPar = !!p && !!par && p.keys <= par

  return (
    <Box sx={{ px: 2, py: 1, bgcolor: 'var(--t-side)', borderBottom: '1px solid var(--t-line, rgba(255,255,255,0.12))', fontSize: 13 }}>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Box sx={{ color: 'var(--t-accent)', fontWeight: 700 }}>
          {challenge.title}
          <Box component="span" sx={{ opacity: 0.6, fontWeight: 400 }}>{` · ${challenge.area} · level ${challenge.level}`}</Box>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, opacity: 0.85 }}>{challenge.brief}</Box>
        <Box sx={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
          {`${state.keys} keys${par ? ` · par ${par}` : ''} · ${fmt(p ? p.secs : state.elapsed)}${best ? ` · best ${best}` : ''}`}
        </Box>
        {!p && hints < steps.length && (
          <Button size="small" color="inherit" onClick={onHint} sx={{ opacity: 0.7 }} title="Reveal a hint (:hint)">
            {hints ? 'More hint' : 'Hint'}
          </Button>
        )}
        {!p && expected !== undefined && (
          <Button size="small" color="inherit" onClick={() => setShowDiff((v) => !v)} sx={{ opacity: 0.7 }} aria-pressed={showDiff}>
            {showDiff ? 'Hide diff' : 'Diff'}
          </Button>
        )}
        <Button size="small" color="inherit" onClick={onRetry} sx={{ opacity: p && !atPar ? 1 : 0.7 }} title="Start this challenge again (:retry)">
          Retry
        </Button>
      </Stack>
      {par ? (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (state.keys / par) * 100)}
          aria-label={`Keys used against par ${par}`}
          sx={{ mt: 0.75, height: 3, bgcolor: 'var(--t-line)', '& .MuiLinearProgress-bar': { bgcolor: over ? 'var(--t-warn)' : 'var(--t-accent)' } }}
        />
      ) : null}
      {hints > 0 && !p && (
        <Box role="note" sx={{ mt: 0.75, opacity: 0.85 }}>
          {steps.slice(0, hints).map((h, i) => (
            <Box key={i}>{`Hint ${i + 1}: ${h}`}</Box>
          ))}
        </Box>
      )}
      {stuck && <Box sx={{ mt: 0.5, opacity: 0.6 }}>{`Not there yet: the ${state.miss.join(' and ')} differs. Finish in normal mode.`}</Box>}
      {diff.length > 0 && !p && (
        <Box
          component="pre"
          aria-label="Your buffer against the expected end state"
          sx={{ m: 0, mt: 0.75, p: 1, maxHeight: 160, overflow: 'auto', bgcolor: 'var(--t-bg)', border: '1px solid var(--t-line)', fontFamily: 'inherit', fontSize: 12.5 }}
        >
          {diff.map((r, i) => (
            <Box key={i} component="div" sx={{ color: r.kind === 'del' ? 'var(--t-warn)' : r.kind === 'add' ? 'var(--t-accent)' : 'inherit', opacity: r.kind === 'same' ? 0.6 : 1, whiteSpace: 'pre-wrap' }}>
              {`${r.kind === 'del' ? '- ' : r.kind === 'add' ? '+ ' : '  '}${r.text}`}
            </Box>
          ))}
        </Box>
      )}
      {showDiff && !p && expected !== undefined && diff.every((r) => r.kind === 'same') && <Box sx={{ mt: 0.5, opacity: 0.6 }}>Text matches. Check the cursor and finish in normal mode.</Box>}
      {p && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ color: 'var(--t-accent)', fontWeight: 700 }}>
            {`Solved in ${p.keys} keys, ${fmt(p.secs)}${par ? (atPar ? ` (at or under par ${par})` : ` (par ${par})`) : ''}`}
            {star > 0 && <Box component="span" aria-label={`${star} of 3 stars`} sx={{ ml: 1 }}>{'★'.repeat(star) + '☆'.repeat(3 - star)}</Box>}
            {par ? <Box component="span" sx={{ ml: 1, fontWeight: 400, opacity: 0.8 }}>{`${efficiency(p.keys, par)}% efficient`}</Box> : null}
            {hints > 0 && <Box component="span" sx={{ ml: 1, fontWeight: 400, opacity: 0.8 }}>{`${hints} hint${hints > 1 ? 's' : ''} used`}</Box>}
          </Box>
          <Box sx={{ opacity: 0.8, mt: 0.25 }}>
            {save === 'saving' && 'Saving your result...'}
            {save === 'saved' && 'Result saved to your account.'}
            {save === 'error' && error}
            {save === 'idle' && status !== 'in' && authConfig && (
              <>
                {'Not saved. '}
                <Button size="small" color="inherit" onClick={() => void login()} sx={{ textDecoration: 'underline', p: 0, minWidth: 0 }}>
                  Sign in
                </Button>
                {' to keep your results.'}
              </>
            )}
          </Box>
          <Stack direction="row" sx={{ mt: 0.75, gap: 1, flexWrap: 'wrap' }}>
            {onNext && (
              <Button size="small" variant="contained" onClick={onNext} title="Open the next challenge (:nextchallenge)">
                Next challenge
              </Button>
            )}
            <Button size="small" variant={onNext ? 'outlined' : 'contained'} color="inherit" onClick={onRetry}>
              {par && !atPar ? `Try again for par ${par}` : 'Play again'}
            </Button>
            <Button size="small" variant="outlined" color="inherit" onClick={() => void copy(resultText(challenge, p.keys, p.secs, par, hints, SITE))}>
              {copied ? 'Copied' : 'Copy result'}
            </Button>
          </Stack>
          {(challenge.why || challenge.solution) && (
            <Box sx={{ mt: 0.5 }}>
              <Button size="small" color="inherit" onClick={() => setShowWhy((v) => !v)} sx={{ p: 0, minWidth: 0, opacity: 0.8 }}>
                {showWhy ? 'Hide the reference solution' : 'Show the reference solution'}
              </Button>
              {showWhy && (
                <Box sx={{ mt: 0.5, opacity: 0.85 }}>
                  {challenge.solution && <Box component="code" sx={{ color: 'var(--t-accent)' }}>{challenge.solution}</Box>}
                  {challenge.why && <Box sx={{ mt: 0.25 }}>{challenge.why}</Box>}
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
