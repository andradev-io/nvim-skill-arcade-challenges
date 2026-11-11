import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { PlayState } from '../../hooks/usePlay'
import type { BuiltinChallenge } from '../../core/builtin'
import { scoreIdOf } from '../../core/builtin'
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

/** The brief of a built-in challenge opened in the Terminal, its live key count, and the result once it is solved. */
export function ChallengeBar({ challenge, state, onRetry }: { challenge: BuiltinChallenge; state: PlayState; onRetry: () => void }) {
  const { save, error } = useSaveResult(challenge, state.passed)
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
  const par = challenge.par_keys
  const [showWhy, setShowWhy] = useState(false)
  const p = state.passed
  return (
    <Box sx={{ px: 2, py: 1, bgcolor: 'var(--t-side)', borderBottom: '1px solid var(--t-line, rgba(255,255,255,0.12))', fontSize: 13 }}>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Box sx={{ color: 'var(--t-accent)', fontWeight: 700 }}>
          {challenge.title}
          <Box component="span" sx={{ opacity: 0.6, fontWeight: 400 }}>{` · ${challenge.area} · level ${challenge.level}`}</Box>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, opacity: 0.85 }}>{challenge.brief}</Box>
        <Box sx={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
          {`${state.keys} keys${par ? ` · par ${par}` : ''} · ${fmt(p ? p.secs : state.elapsed)}`}
        </Box>
        <Button size="small" color="inherit" onClick={onRetry} sx={{ opacity: 0.7 }}>
          Retry
        </Button>
      </Stack>
      {!p && state.keys > 0 && state.miss.length > 0 && state.mode === 'normal' && (
        <Box sx={{ mt: 0.5, opacity: 0.6 }}>{`Not there yet: the ${state.miss.join(' and ')} differs. Finish in normal mode.`}</Box>
      )}
      {p && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ color: 'var(--t-accent)', fontWeight: 700 }}>
            {`Solved in ${p.keys} keys, ${fmt(p.secs)}${par ? (p.keys <= par ? ` (at or under par ${par})` : ` (par ${par})`) : ''}`}
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
