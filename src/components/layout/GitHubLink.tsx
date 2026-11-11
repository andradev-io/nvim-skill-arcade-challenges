import GitHubIcon from '@mui/icons-material/GitHub'
import StarIcon from '@mui/icons-material/Star'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { formatStars, useStars } from '../../hooks/useStars'

const REPO = 'andradev-io/nvim-skill-arcade'
const HREF = `https://github.com/${REPO}`
const OPEN = { target: '_blank', rel: 'noopener noreferrer' } as const

/** The GitHub link of the header. Shows the star count next to the mark once it is known (and not zero). */
export function GitHubLink({ small = false }: { small?: boolean }) {
  const stars = useStars(REPO)
  if (!stars) {
    return (
      <IconButton size={small ? 'small' : 'medium'} aria-label="nvim-skill-arcade on GitHub" href={HREF} {...OPEN}>
        <GitHubIcon fontSize="small" />
      </IconButton>
    )
  }
  return (
    <Button
      color="inherit"
      size="small"
      href={HREF}
      {...OPEN}
      aria-label={`nvim-skill-arcade on GitHub, ${stars} ${stars === 1 ? 'star' : 'stars'}`}
      title={`${stars} ${stars === 1 ? 'star' : 'stars'} on GitHub`}
      startIcon={<GitHubIcon fontSize="small" />}
      sx={{ minWidth: 0, px: 1, gap: 0, opacity: 0.9, '& .MuiButton-startIcon': { mr: 0.75 } }}
    >
      <StarIcon sx={{ fontSize: 14, mr: 0.25, color: 'primary.main' }} />
      {formatStars(stars)}
    </Button>
  )
}
