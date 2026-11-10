import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { requestUrl } from '../../plugins/registry'
import { KeymapReport } from './KeymapSource'
import { PluginList } from './PluginList'

export type InfoTab = 'keymaps' | 'plugins'

/** What works and what does not, out of the side menu: your keymaps and the plugin list, with a way to ask for more. */
export function InfoDialog({ tab, onTab, onClose }: { tab: InfoTab | null; onTab: (t: InfoTab) => void; onClose: () => void }) {
  return (
    <Dialog open={tab !== null} onClose={onClose} fullWidth maxWidth="md" scroll="paper" className="dark">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Box sx={{ flex: 1 }}>What works here</Box>
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Tabs value={tab ?? 'keymaps'} onChange={(_, v: InfoTab) => onTab(v)} sx={{ px: 2 }}>
        <Tab value="keymaps" label="Keymaps" />
        <Tab value="plugins" label="Plugins" />
      </Tabs>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        {tab === 'plugins' ? <PluginList /> : <KeymapReport />}
      </DialogContent>
      <Stack direction="row" sx={{ gap: 1.5, p: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" href={requestUrl('')} target="_blank" rel="noopener noreferrer">
          Request plugin support
        </Button>
        <Button variant="outlined" href="#/support" onClick={onClose}>
          Full page
        </Button>
      </Stack>
    </Dialog>
  )
}
