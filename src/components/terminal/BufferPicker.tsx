import { useState } from 'react'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import type { BuiltinChallenge } from '../../core/builtin'
import { shortName } from '../../core/builtin'
import type { TerminalBuffer } from '../../store/terminalStore'

export interface PickerData {
  /** The buffer of the draft being written on the Create page, if there is one. */
  draft: TerminalBuffer | null
  examples: TerminalBuffer[]
  community: TerminalBuffer[]
  builtin: BuiltinChallenge[]
  scratch: TerminalBuffer
}

type Kind = 'yours' | 'examples' | 'community' | 'builtin'
const KINDS: { id: Kind; label: string }[] = [
  { id: 'yours', label: 'Yours' },
  { id: 'examples', label: 'Examples' },
  { id: 'community', label: 'Community' },
  { id: 'builtin', label: 'Built-in' },
]

const keyOf = (b: TerminalBuffer): string => b.challenge?.id ?? b.name

const sub = { bgcolor: 'background.paper', lineHeight: '28px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' } as const

/** The challenges of one area as buffers, easiest first. */
function builtinItems(list: BuiltinChallenge[]): { area: string; items: TerminalBuffer[] }[] {
  const byArea = new Map<string, BuiltinChallenge[]>()
  for (const c of list) byArea.set(c.area, [...(byArea.get(c.area) ?? []), c])
  return [...byArea.entries()].map(([area, items]) => ({
    area,
    items: [...items]
      .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
      .map((c) => ({ name: shortName(c), text: c.text, cursor: c.cursor, challenge: c })),
  }))
}

/** Two dropdowns: first what kind of buffer (yours, examples, community, built-in), then the ones of that kind. */
export function BufferPicker({ buffer, data, onOpen }: { buffer: TerminalBuffer; data: PickerData; onOpen: (b: TerminalBuffer) => void }) {
  // the kind the user picked counts only for the buffer that was open then; another buffer (opened elsewhere) shows its own kind
  const [pick, setPick] = useState<{ kind: Kind; forKey: string } | null>(null)
  const yours = [data.scratch, ...(data.draft ? [data.draft] : [])]
  const flat: Record<Kind, TerminalBuffer[]> = {
    yours,
    examples: data.examples,
    community: data.community,
    builtin: builtinItems(data.builtin).flatMap((g) => g.items),
  }
  const count = (k: Kind) => flat[k].length
  const inferred = KINDS.find((k) => flat[k.id].some((b) => keyOf(b) === keyOf(buffer)))?.id
  const kind: Kind = pick && pick.forKey === keyOf(buffer) ? pick.kind : (inferred ?? pick?.kind ?? 'yours')
  const current = flat[kind].some((b) => keyOf(b) === keyOf(buffer)) ? keyOf(buffer) : ''
  const areas = kind === 'builtin' ? builtinItems(data.builtin) : [{ area: '', items: flat[kind] }]

  return (
    <Stack spacing={1}>
      <Select
        size="small"
        fullWidth
        value={kind}
        onChange={(e) => setPick({ kind: e.target.value as Kind, forKey: keyOf(buffer) })}
        inputProps={{ 'aria-label': 'Kind of buffer' }}
        sx={{ fontSize: 13 }}
      >
        {KINDS.map((k) => (
          <MenuItem key={k.id} value={k.id} dense disabled={count(k.id) === 0}>
            {`${k.label} (${count(k.id)})`}
          </MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        fullWidth
        displayEmpty
        value={current}
        onChange={(e) => {
          const b = flat[kind].find((x) => keyOf(x) === e.target.value)
          if (b) onOpen(b)
        }}
        renderValue={(v) => (v ? buffer.name : 'Pick one...')}
        inputProps={{ 'aria-label': 'Open a buffer' }}
        sx={{ fontSize: 13 }}
      >
        {areas.flatMap((g) => [
          ...(g.area ? [<ListSubheader key={`h-${g.area}`} sx={sub}>{g.area}</ListSubheader>] : []),
          ...g.items.map((b) => (
            <MenuItem key={keyOf(b)} value={keyOf(b)} dense>
              {b.name}
            </MenuItem>
          )),
        ])}
      </Select>
    </Stack>
  )
}
