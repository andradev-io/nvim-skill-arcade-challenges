// Room code: ARC1.<base64url, no padding, of the minified draft JSON>.
// The plugin decodes it and runs it through its own schema; no server is involved.
import type { Challenge } from './types'

export const CODE_PREFIX = 'ARC1.'

export function encodeDraft(data: Challenge): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return CODE_PREFIX + btoa(bin).split('+').join('-').split('/').join('_').replace(/=+$/, '')
}

/** Inverse of encodeDraft, used by tests and handy for debugging. Returns null for a damaged code. */
export function decodeDraft(code: string): unknown {
  if (!code.startsWith(CODE_PREFIX)) return null
  try {
    let b64 = code.slice(CODE_PREFIX.length).split('-').join('+').split('_').join('/')
    while (b64.length % 4) b64 += '='
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export const joinCommand = (code: string): string => `:ArcadeJoin ${code}`

export function fileCommand(folder: string, id: string): string {
  const dir = folder.trim().replace(/[\\/]+$/, '') || '~/Downloads'
  return ':ArcadeTry ' + `${dir}/${id || 'challenge'}.json`.replace(/ /g, '\\ ')
}
