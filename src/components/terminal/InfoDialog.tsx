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
import Typography from '@mui/material/Typography'
import { requestUrl } from '../../plugins/registry'
import { KeymapReport } from './KeymapSource'
import { PluginList } from './PluginList'

export type InfoTab = 'keymaps' | 'plugins' | 'about'

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
        <Tab value="about" label="About" />
      </Tabs>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        {tab === 'plugins' ? (
          <PluginList />
        ) : tab === 'about' ? (
          <Typography sx={{ lineHeight: 1.8, opacity: 0.9 }}>
            A free sandbox: nothing is scored or counted. This is a Vim emulation in the browser, not your Neovim, so plugins
            are imitated rather than run, and a few commands behave a little differently. Esc stays with Vim. Typing{' '}
            <code>:</code> opens the command line. Your keymap files are read, never run, and stay in this browser.
          </Typography>
        ) : (
          <KeymapReport />
        )}
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
