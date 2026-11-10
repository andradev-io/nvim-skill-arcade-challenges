import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { PLUGINS, requestUrl } from '../../plugins/registry'
import { isOn, usePluginStore } from '../../store/pluginStore'

/**
 * The browser Vim's plugin imitations. Compact: one switch per plugin (side menu). Full: notes, keys and the
 * plugins that cannot work, with the reason and a link to ask for them (dialog).
 */
export function PluginList({ compact = false, onDetails }: { compact?: boolean; onDetails?: () => void }) {
  const s = usePluginStore()
  const found = (id: string) => s.detected.includes(id)
  const shims = PLUGINS.filter((p) => p.status !== 'unsupported')
  const rest = PLUGINS.filter((p) => p.status === 'unsupported')

  if (compact) {
    return (
      <Stack spacing={0.25}>
        {shims.map((p) => (
          <Stack key={p.id} direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
            <Switch size="small" checked={isOn(s, p.id)} onChange={(e) => s.setOn(p.id, e.target.checked)} slotProps={{ input: { 'aria-label': p.name } }} />
            <Typography sx={{ fontSize: 13, flex: 1 }}>{p.name}</Typography>
            {found(p.id) && <Chip size="small" color="success" variant="outlined" label="yours" sx={{ height: 18, fontSize: 10 }} />}
          </Stack>
        ))}
        {onDetails && (
          <Button size="small" variant="outlined" color="inherit" onClick={onDetails} sx={{ alignSelf: 'flex-start', mt: 1 }}>
            Supported and not supported
          </Button>
        )}
      </Stack>
    )
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" sx={{ fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
        Imitations of popular plugins, written for this editor. They behave like the real ones for the common keys.
        {s.detected.length > 0 ? ' Plugins found in your config are switched on.' : ' All are on until you load a config.'}
      </Typography>
      {shims.map((p) => (
        <Box key={p.id}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
            <Switch size="small" checked={isOn(s, p.id)} onChange={(e) => s.setOn(p.id, e.target.checked)} slotProps={{ input: { 'aria-label': p.name } }} />
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{p.name}</Typography>
            {p.status === 'partial' && <Chip size="small" variant="outlined" label="partial" sx={{ height: 18, fontSize: 10 }} />}
            {found(p.id) && <Chip size="small" color="success" variant="outlined" label="in your config" sx={{ height: 18, fontSize: 10 }} />}
          </Stack>
          <Typography sx={{ fontSize: 12.5, opacity: 0.7, lineHeight: 1.55, ml: 5.5 }}>{p.note}</Typography>
          {p.keys && (
            <Typography sx={{ fontSize: 12.5, ml: 5.5, opacity: 0.9 }} component="code">
              {p.keys}
            </Typography>
          )}
        </Box>
      ))}
      <Typography sx={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.55, pt: 1 }}>Not possible here</Typography>
      {rest.map((p) => (
        <Box key={p.id} sx={{ opacity: found(p.id) ? 1 : 0.8 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 14 }}>{p.name}</Typography>
            {found(p.id) && <Chip size="small" color="warning" variant="outlined" label="in your config" sx={{ height: 18, fontSize: 10 }} />}
            <Link href={requestUrl(p.name)} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 12 }}>
              ask for it
            </Link>
          </Stack>
          <Typography sx={{ fontSize: 12.5, opacity: 0.7, lineHeight: 1.55 }}>{p.note}</Typography>
        </Box>
      ))}
    </Stack>
  )
}
