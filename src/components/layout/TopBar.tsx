import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useColorScheme } from '@mui/material/styles'

export function TopBar() {
  const { mode, systemMode, setMode } = useColorScheme()
  const resolved = mode === 'system' ? systemMode : mode
  const dark = resolved === 'dark'
  return (
    <Stack component="header" spacing={1} sx={{ pt: 3.5, pb: 1, position: 'relative' }}>
      <Typography variant="h1" sx={{ fontSize: 24, pr: 7 }}>
        Skill Arcade Challenges
      </Typography>
      <IconButton
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => setMode(dark ? 'light' : 'dark')}
        sx={{ position: 'absolute', top: 24, right: 0, border: 1, borderColor: 'primary.main' }}
      >
        {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
      </IconButton>
      <Typography sx={{ maxWidth: '74ch', opacity: 0.85 }}>
        Design a challenge for{' '}
        <Link href="https://github.com/dev-vinicius-andrade/nvim-skill-arcade">nvim-skill-arcade</Link>. A challenge is{' '}
        <b>data</b>: a start buffer plus the expected end state. Any key sequence that reaches it wins. Try it as you write
        it, here or in Neovim. Your reference solution is replayed by CI before anything is published, and no uploaded code
        is ever executed.
      </Typography>
    </Stack>
  )
}
