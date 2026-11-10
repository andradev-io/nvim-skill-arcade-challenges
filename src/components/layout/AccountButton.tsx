import GitHubIcon from '@mui/icons-material/GitHub'
import PersonIcon from '@mui/icons-material/Person'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { useAuthStore } from '../../auth/authStore'
import { navigate, useRoute } from '../../hooks/useRoute'

/** "Sign in" while signed out, "Account" once in. Renders nothing on a build where sign-in is not set up. */
export function AccountButton({ compact = false }: { compact?: boolean }) {
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
  const route = useRoute()
  if (status === 'off') return null

  const signedIn = status === 'in'
  const label = signedIn ? 'Account' : 'Sign in'
  const act = () => (signedIn ? navigate('account') : void login())

  if (compact) {
    return (
      <IconButton size="small" aria-label={signedIn ? 'Your account' : 'Sign in with GitHub'} onClick={act} disabled={status === 'loading'}>
        {signedIn ? <PersonIcon fontSize="small" /> : <GitHubIcon fontSize="small" />}
      </IconButton>
    )
  }
  return (
    <Button
      size="small"
      variant={signedIn && route === 'account' ? 'outlined' : 'text'}
      color={signedIn ? 'primary' : 'inherit'}
      startIcon={signedIn ? <PersonIcon fontSize="small" /> : <GitHubIcon fontSize="small" />}
      onClick={act}
      disabled={status === 'loading'}
      sx={{ whiteSpace: 'nowrap' }}
    >
      {label}
    </Button>
  )
}
