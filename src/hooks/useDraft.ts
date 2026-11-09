import { useMemo } from 'react'
import { useDraftStore } from '../store/draftStore'
import { buildChallenge, MAX_URL, submitUrl } from '../core/schema'
import { encodeDraft } from '../core/roomCode'

/** Everything derived from the form: the challenge, its errors, JSON, room code and PR link. */
export function useDraft() {
  const form = useDraftStore((s) => s.form)
  return useMemo(() => {
    const { data, errors } = buildChallenge(form)
    const json = JSON.stringify(data, null, 2) + '\n'
    const ok = errors.length === 0
    const url = submitUrl(data, json)
    return {
      data,
      errors,
      json,
      ok,
      code: encodeDraft(data),
      prUrl: ok && url.length < MAX_URL ? url : null,
      prTooLong: ok && url.length >= MAX_URL,
    }
  }, [form])
}
