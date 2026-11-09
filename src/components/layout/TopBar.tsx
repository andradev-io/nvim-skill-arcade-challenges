import GitHubIcon from '@mui/icons-material/GitHub'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'

const REPO_URL = 'https://github.com/dev-vinicius-andrade/nvim-skill-arcade'

export function TopBar() {
  const { mode, systemMode, setMode } = useColorScheme()
  const dark = (mode === 'system' ? systemMode : mode) === 'dark'
  return (
    <Stack
      component="header"
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between', py: 2, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
        arcade<Typography component="span" color="primary" sx={{ fontWeight: 800 }}>.nvim</Typography>
        <Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>/ challenges</Typography>
      </Typography>
      <Stack direction="row" sx={{ gap: 1 }}>
        <IconButton aria-label="nvim-skill-arcade on GitHub" href={REPO_URL} target="_blank" rel="noopener">
          <GitHubIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setMode(dark ? 'light' : 'dark')}
        >
          {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Stack>
    </Stack>
  )
}
