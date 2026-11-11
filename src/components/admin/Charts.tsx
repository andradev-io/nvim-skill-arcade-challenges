import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { labelIndexes, niceMax, shortDay, ticks } from './chartMath'

const ACCENT = 'var(--mui-palette-primary-main, #c3c75a)'
const MUTED = 'var(--mui-palette-text-secondary, #999)'
const GRID = 'var(--mui-palette-divider, #333)'

export interface TimePoint {
  day: string
  /** Drawn as a bar. */
  bar: number
  /** Drawn as a line on top of the bars. */
  line?: number
}

interface TimeChartProps {
  points: TimePoint[]
  barLabel: string
  lineLabel?: string
  /** Read out by screen readers, since the picture itself is not. */
  summary: string
}

const W = 720
const H = 220
const M = { l: 38, r: 8, t: 10, b: 24 }

/** Bars per day with an optional line over them. Plain SVG: no chart library. */
export function TimeChart({ points, barLabel, lineLabel, summary }: TimeChartProps) {
  const n = points.length
  const top = niceMax(Math.max(0, ...points.map((p) => Math.max(p.bar, p.line ?? 0))))
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b
  const slot = n > 0 ? iw / n : iw
  const x = (i: number) => M.l + slot * i + slot / 2
  const y = (v: number) => M.t + ih - (v / top) * ih
  const line = lineLabel ? points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.line ?? 0).toFixed(1)}`).join(' ') : ''

  return (
    <Box>
      <Stack direction="row" sx={{ gap: 2, mb: 0.5, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: MUTED, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" sx={{ width: 10, height: 10, bgcolor: ACCENT, opacity: 0.4, display: 'inline-block' }} />
          {barLabel}
        </Typography>
        {lineLabel && (
          <Typography variant="caption" sx={{ color: MUTED, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" sx={{ width: 14, height: 0, borderTop: `2px solid ${ACCENT}`, display: 'inline-block' }} />
            {lineLabel}
          </Typography>
        )}
      </Stack>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks(top).map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={MUTED}>
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <rect key={p.day} x={x(i) - slot * 0.35} y={y(p.bar)} width={slot * 0.7} height={Math.max(0, M.t + ih - y(p.bar))} fill={ACCENT} opacity={0.4}>
            <title>{`${shortDay(p.day)}: ${p.bar} ${barLabel}${lineLabel ? `, ${p.line ?? 0} ${lineLabel}` : ''}`}</title>
          </rect>
        ))}
        {lineLabel && n > 0 && (
          <>
            <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={p.day} cx={x(i)} cy={y(p.line ?? 0)} r={n > 45 ? 1.5 : 3} fill={ACCENT}>
                <title>{`${shortDay(p.day)}: ${p.line ?? 0} ${lineLabel}`}</title>
              </circle>
            ))}
          </>
        )}
        {labelIndexes(n).map((i) => (
          <text key={points[i].day} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} fill={MUTED}>
            {shortDay(points[i].day)}
          </text>
        ))}
      </svg>
    </Box>
  )
}

export interface BarItem {
  label: string
  value: number
  /** A part of `value` drawn solid (for example "finished" inside "started"). */
  part?: number
}

/** Horizontal bars with the label above the bar, so long names wrap instead of squeezing the chart. */
export function BarList({ items, partLabel, empty }: { items: BarItem[]; partLabel?: string; empty: string }) {
  if (items.length === 0) return <Typography sx={{ opacity: 0.7 }}>{empty}</Typography>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <Stack component="ul" sx={{ gap: 1.25, p: 0, m: 0, listStyle: 'none' }}>
      {items.map((it) => (
        <li key={it.label}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {it.label}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              {it.part !== undefined && partLabel ? `${it.part} ${partLabel} / ${it.value}` : it.value}
            </Typography>
          </Stack>
          <Box sx={{ position: 'relative', height: 8, bgcolor: GRID, borderRadius: 1, mt: 0.5, overflow: 'hidden' }} aria-hidden>
            <Box sx={{ position: 'absolute', inset: 0, width: `${(it.value / max) * 100}%`, bgcolor: ACCENT, opacity: it.part !== undefined ? 0.4 : 1 }} />
            {it.part !== undefined && <Box sx={{ position: 'absolute', inset: 0, width: `${(it.part / max) * 100}%`, bgcolor: ACCENT }} />}
          </Box>
        </li>
      ))}
    </Stack>
  )
}
