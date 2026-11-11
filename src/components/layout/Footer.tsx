import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

const PLUGIN = 'https://github.com/andradev-io/nvim-skill-arcade'
const SITE = 'https://github.com/andradev-io/nvim-skill-arcade-challenges'
const OPEN = { target: '_blank', rel: 'noopener noreferrer' } as const

const LINKS = [
  { label: 'Plugin', href: PLUGIN },
  { label: 'This site on GitHub', href: SITE },
  { label: 'How to contribute', href: `${SITE}/blob/main/CONTRIBUTING.md` },
  { label: 'Report an issue', href: `${SITE}/issues` },
]

/** Page footer: where the code lives, how to contribute, and what the site counts. */
export function Footer() {
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', mt: 4 }}>
      <Stack
        sx={{
          maxWidth: 1760,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: 2.5,
          gap: 1,
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
        }}
      >
        <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2.5, rowGap: 0.5 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} {...OPEN} variant="body2" color="text.secondary" underline="hover">
              {l.label}
            </Link>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 720 }}>
          Challenges are data only, checked by the same schema the plugin uses. Page views and plays are counted
          anonymously: no cookies, no addresses stored, and nothing at all if your browser sends Do Not Track.
        </Typography>
      </Stack>
    </Box>
  )
}
