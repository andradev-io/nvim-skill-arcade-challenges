import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { formatCheckpoints, MAX_CHECKPOINTS, parseCheckpoints } from '../../core/schema'
import type { Cursor, DraftForm } from '../../core/types'
import { useDraftStore } from '../../store/draftStore'
import { Field } from '../common/Field'
import { Row } from '../common/Row'
import { Section } from '../common/Section'

type Tool = 'start' | 'goal' | 'checkpoint' | 'clear'

const num = (s: string): number | null => (s.trim() !== '' && Number.isInteger(Number(s)) ? Number(s) : null)
const same = (a: Cursor | null, r: number, c: number): boolean => !!a && a[0] === r && a[1] === c

/** Clickable grid of the start buffer: place the start, the goal and the ordered checkpoints. */
function MapEditor() {
  const form = useDraftStore((s) => s.form)
  const set = useDraftStore((s) => s.set)
  const [tool, setTool] = useState<Tool>('goal')
  const lines = form.text.split('\n')
  const start: Cursor | null = num(form.crow) !== null && num(form.ccol) !== null ? [Number(form.crow), Number(form.ccol)] : null
  const gr = num(form.goalRow)
  const gc = num(form.goalCol)
  const goal: Cursor | null = gr !== null && gc !== null ? [gr, gc] : null
  const cps = parseCheckpoints(form.checkpoints) ?? []

  const place = (row: number, col: number) => {
    const set2 = <K extends keyof DraftForm>(k: K, v: DraftForm[K]) => set(k, v)
    if (tool === 'start') {
      set2('crow', String(row))
      set2('ccol', String(col))
    } else if (tool === 'goal') {
      set2('goalRow', String(row))
      set2('goalCol', String(col))
      set2('checkpoints', formatCheckpoints(cps.filter(([r, c]) => !(r === row && c === col))))
    } else if (tool === 'checkpoint') {
      const at = cps.findIndex(([r, c]) => r === row && c === col)
      if (at >= 0) set2('checkpoints', formatCheckpoints(cps.filter((_, i) => i !== at)))
      else if (cps.length < MAX_CHECKPOINTS && !same(goal, row, col)) set2('checkpoints', formatCheckpoints([...cps, [row, col]]))
    } else {
      set2('checkpoints', formatCheckpoints(cps.filter(([r, c]) => !(r === row && c === col))))
      if (same(goal, row, col)) {
        set2('goalRow', '')
        set2('goalCol', '')
      }
    }
  }

  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={tool}
        onChange={(_, v: Tool | null) => v && setTool(v)}
        aria-label="Map tool"
        sx={{ flexWrap: 'wrap', mb: 1 }}
      >
        <ToggleButton value="start">Start</ToggleButton>
        <ToggleButton value="goal">Goal</ToggleButton>
        <ToggleButton value="checkpoint">Checkpoint</ToggleButton>
        <ToggleButton value="clear">Clear</ToggleButton>
      </ToggleButtonGroup>
      <Box
        role="grid"
        aria-label="Track map"
        sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: '10px', p: 1, fontFamily: 'inherit' }}
      >
        {lines.map((line, r) => (
          <Box key={r} role="row" sx={{ display: 'flex', whiteSpace: 'pre' }}>
            {(line === '' ? ' ' : line).split('').map((ch, c) => {
              const row = r + 1
              const isStart = same(start, row, c)
              const isGoal = same(goal, row, c)
              const n = cps.findIndex(([cr, cc]) => cr === row && cc === c)
              const mark = isGoal ? 'X' : n >= 0 ? String(n + 1) : isStart ? 'S' : ch
              const color = isGoal ? 'success.main' : n >= 0 ? 'warning.main' : isStart ? 'primary.main' : 'text.secondary'
              const label = `row ${row} col ${c}${isStart ? ' start' : ''}${isGoal ? ' goal' : ''}${n >= 0 ? ` checkpoint ${n + 1}` : ''}`
              return (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  role="gridcell"
                  aria-label={label}
                  onClick={() => place(row, c)}
                  sx={{
                    width: 22,
                    height: 26,
                    p: 0,
                    m: 0,
                    border: '1px solid transparent',
                    borderRadius: '5px',
                    background: 'transparent',
                    font: 'inherit',
                    cursor: 'pointer',
                    color,
                    fontWeight: isGoal || n >= 0 || isStart ? 700 : 400,
                    outline: isGoal || n >= 0 || isStart ? '1px solid currentColor' : 'none',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  {mark === ' ' ? '·' : mark}
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Pick a tool, click a cell. S = start (cursor begins here), X = goal, 1-{MAX_CHECKPOINTS} = checkpoints to touch in
        order. The map text itself stays as typed above.
      </Typography>
    </Box>
  )
}

export function TrackSection() {
  const f = useDraftStore((s) => s.form)
  const set = useDraftStore((s) => s.set)
  const flag = (k: 'forbidHjkl' | 'forbidArrows' | 'forbidMouse', label: string) => (
    <FormControlLabel label={label} control={<Checkbox checked={f[k]} onChange={(e) => set(k, e.target.checked)} />} />
  )
  return (
    <Section title="2. Track: goal, checkpoints and rules">
      <MapEditor />
      <Row>
        <Field field="goalRow" label="Goal row (1-based)" type="number" />
        <Field field="goalCol" label="Goal col (0-based)" type="number" />
      </Row>
      <Field
        field="checkpoints"
        label="Checkpoints in order (row:col, row:col)"
        placeholder="2:3, 4:5"
        helper={`Up to ${MAX_CHECKPOINTS}. Each is a cell of the map, not the goal. The cursor must land exactly on them, in order.`}
      />
      <Box>
        <Typography variant="body2" color="text.secondary">
          Key rules (buffer-local, only on this map)
        </Typography>
        {flag('forbidHjkl', 'No h j k l')}
        {flag('forbidArrows', 'No arrow keys')}
        {flag('forbidMouse', 'No mouse')}
      </Box>
      <Typography variant="caption" color="text.secondary">
        Only the end state is judged: cursor on the goal, every checkpoint reached in order, map text unchanged. The
        start cursor is set in section 1 (or with the Start tool). Keep the map ASCII.
      </Typography>
    </Section>
  )
}
