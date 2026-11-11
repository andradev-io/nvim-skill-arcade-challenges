import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'
import { ROUTES, navigate, useRoute } from '../../hooks/useRoute'
import { AccountButton } from './AccountButton'
import { GitHubLink } from './GitHubLink'

/** Site header: brand, page navigation, GitHub and theme. The nav drops under the brand on a phone. */
export function TopBar({ fluid = false }: { fluid?: boolean }) {
  const { mode, systemMode, setMode } = useColorScheme()
  const dark = (mode === 'system' ? systemMode : mode) === 'dark'
  const route = useRoute()
  return (
    <Box
      component="header"
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <Stack
        sx={{
          maxWidth: fluid ? 'none' : 1760,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: 1,
          gap: { xs: 0.5, md: 3 },
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Typography
            component="a"
            href="#/"
            sx={{ fontWeight: 800, letterSpacing: '-0.01em', color: 'text.primary', textDecoration: 'none' }}
          >
            arcade<Typography component="span" color="primary" sx={{ fontWeight: 800 }}>.nvim</Typography>
          </Typography>
          <Stack direction="row" sx={{ gap: 0.5, display: { xs: 'flex', md: 'none' } }}>
            <AccountButton compact />
            <GitHubLink small />
            <IconButton size="small" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setMode(dark ? 'light' : 'dark')}>
              {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </Stack>
        <Stack component="nav" aria-label="Pages" direction="row" sx={{ gap: 0.5, flex: 1, overflowX: 'auto' }}>
          {ROUTES.filter((r) => !r.hidden).map((r) => (
            <Button
              key={r.id}
              href={r.hash}
              onClick={(e) => {
                e.preventDefault()
                navigate(r.id)
              }}
              color={route === r.id ? 'primary' : 'inherit'}
              variant={route === r.id ? 'outlined' : 'text'}
              size="small"
              aria-current={route === r.id ? 'page' : undefined}
              sx={{ whiteSpace: 'nowrap', opacity: route === r.id ? 1 : 0.8 }}
            >
              {r.label}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', display: { xs: 'none', md: 'flex' } }}>
          <AccountButton />
          <GitHubLink />
          <IconButton aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setMode(dark ? 'light' : 'dark')}>
            {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  )
}
