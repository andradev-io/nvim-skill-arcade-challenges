import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { PLUGINS } from '../../plugins/registry'
import { isOn, usePluginStore } from '../../store/pluginStore'

/** Sidebar block: which plugins the browser Vim imitates (switchable), and which it cannot, with the reason. */
export function PluginList() {
  const s = usePluginStore()
  const found = (id: string) => s.detected.includes(id)
  const shims = PLUGINS.filter((p) => p.status !== 'unsupported')
  const rest = PLUGINS.filter((p) => p.status === 'unsupported')
  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" sx={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
        Imitations of popular plugins, written for this editor. They behave like the real ones for the common keys.
        {s.detected.length > 0 ? ' Plugins found in your config are switched on.' : ' All are on until you load a config.'}
      </Typography>
      {shims.map((p) => (
        <Box key={p.id}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
            <Switch size="small" checked={isOn(s, p.id)} onChange={(e) => s.setOn(p.id, e.target.checked)} slotProps={{ input: { 'aria-label': p.name } }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.name}</Typography>
            {p.status === 'partial' && <Chip size="small" variant="outlined" label="partial" sx={{ height: 18, fontSize: 10 }} />}
            {found(p.id) && <Chip size="small" color="success" variant="outlined" label="in your config" sx={{ height: 18, fontSize: 10 }} />}
          </Stack>
          <Typography sx={{ fontSize: 11.5, opacity: 0.7, lineHeight: 1.55, ml: 5.5 }}>{p.note}</Typography>
          {p.keys && (
            <Typography sx={{ fontSize: 11.5, ml: 5.5, opacity: 0.9 }} component="code">
              {p.keys}
            </Typography>
          )}
        </Box>
      ))}
      <Typography sx={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.55, pt: 0.5 }}>Not possible here</Typography>
      {rest.map((p) => (
        <Box key={p.id} sx={{ opacity: found(p.id) ? 1 : 0.75 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: 13 }}>{p.name}</Typography>
            {found(p.id) && <Chip size="small" color="warning" variant="outlined" label="in your config" sx={{ height: 18, fontSize: 10 }} />}
          </Stack>
          <Typography sx={{ fontSize: 11.5, opacity: 0.7, lineHeight: 1.55 }}>{p.note}</Typography>
        </Box>
      ))}
    </Stack>
  )
}
