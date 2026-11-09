import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useDraftStore } from '../../store/draftStore'

const STEPS = [
  { n: '1', title: 'Describe', text: 'A start buffer, the expected end state and a reference solution. No code, only data.' },
  { n: '2', title: 'Play', text: 'Try it right here with Vim keys, or join the room in your own Neovim with your own keybinds.' },
  { n: '3', title: 'Submit', text: 'Open a pull request. CI replays your solution in real Neovim before anything is published.' },
]

const go = () => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export function Hero() {
  const reset = useDraftStore((s) => s.reset)
  return (
    <Stack component="section" sx={{ gap: 3, py: { xs: 4, md: 7 } }}>
      <Box>
        <Typography variant="overline" color="primary">
          nvim-skill-arcade · community challenges
        </Typography>
        <Typography variant="h1" sx={{ fontSize: 'clamp(30px, 5.5vw, 52px)', mt: 1, maxWidth: '16ch' }}>
          Design a Vim challenge. Play it. Ship it.
        </Typography>
        <Typography sx={{ mt: 2, maxWidth: '62ch', opacity: 0.85 }}>
          A challenge is a start buffer and the state it should end in. Any key sequence that gets there wins, so the best
          ones have one clear goal and many routes. An example is already loaded below: press a few keys and see how it plays.
        </Typography>
        <Stack direction="row" sx={{ gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
          <Button variant="contained" size="large" onClick={go}>
            Try the example
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              reset()
              go()
            }}
          >
            Start blank
          </Button>
        </Stack>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {STEPS.map((s) => (
          <Box key={s.n} sx={{ border: 1, borderColor: 'divider', borderRadius: '10px', p: 2, display: 'flex', gap: 1.5 }}>
            <Typography color="primary" sx={{ fontWeight: 800, fontSize: 28, lineHeight: 1 }}>
              {s.n}
            </Typography>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{s.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {s.text}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Stack>
  )
}
