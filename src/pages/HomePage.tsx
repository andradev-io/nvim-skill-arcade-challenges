import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { AREAS } from '../core/schema'
import { navigate } from '../hooks/useRoute'
import type { Route } from '../hooks/useRoute'
import { useCommunity } from '../hooks/useCommunity'
import { EXAMPLES } from '../examples'
import { CodeBlock } from '../components/common/CodeBlock'
import { CountUp } from '../components/common/CountUp'
import { useStats } from '../hooks/useStats'
import { authConfig } from '../auth/config'

const INSTALL = `{
  "andradev-io/nvim-skill-arcade",
  cmd = { "ArcadeMenu", "ArcadeRun", "ArcadeSync", "ArcadeTry", "ArcadeJoin", "ArcadeLogin", "ArcadeAccount" },
  keys = {
    { "<leader>Gm", "<cmd>ArcadeMenu<cr>", desc = "Arcade: menu" },
    { "<leader>Gg", "<cmd>ArcadeRun<cr>", desc = "Arcade: start a run" },
  },
  opts = { keymaps = false },
}`

const FEATURES: { title: string; text: string; to?: Route; cta?: string }[] = [
  {
    title: 'Your setup, not a sandbox',
    text: 'The game runs inside your Neovim. Your mappings and plugins stay active, and only the resulting buffer is judged, so flash, surround or telescope count as much as plain motions.',
  },
  {
    title: 'Lessons after every round',
    text: 'You see a better way to do it, which of your installed plugins could have helped, and the habits to drop (hjkl spam, arrow keys, the mouse).',
  },
  {
    title: 'Tracks',
    text: 'Reach a goal on a text-grid map, touching checkpoints in order, sometimes with hjkl or the arrows switched off. Built for the motions you never practise.',
    to: 'create',
    cta: 'Design a track',
  },
  {
    title: 'A terminal in the browser',
    text: 'Try motions right here, with your own keymaps read straight from your GitHub dotfiles. Nothing is executed and nothing leaves your browser.',
    to: 'terminal',
    cta: 'Open the terminal',
  },
  {
    title: 'Community challenges',
    text: 'Anyone can design a challenge, play it in the browser and send it as a pull request. CI replays the solution in real Neovim before it is published.',
    to: 'create',
    cta: 'Create a challenge',
  },
  {
    title: 'Same rules everywhere',
    text: 'The site and the plugin share one schema. What you build here plays in the game after :ArcadeSync, or instantly with a room code (:ArcadeJoin).',
    to: 'challenges',
    cta: 'Browse published',
  },
]

const WHY_SIGN_IN = [
  'The only thing it unlocks is the leaderboard: your best result (fewest keys, then least time) per challenge, under a short player code. It counts what you play in the browser terminal, and what you play in Neovim if you sign in there too.',
  'Nothing else needs it. Playing, the terminal, creating challenges, the AI section and the whole plugin work signed out, and nothing is sent unless you choose it.',
  'The site and its score service never receive your name, e-mail or GitHub account. The code is derived from your login, is the same every time and cannot be traced back to you.',
  'Scores are reported by the client, so the board is an honor system.',
]

const IN_NEOVIM = [
  [':ArcadeMenu', 'start here: it lists only what you can do right now, and shows your own keys'],
  [':ArcadeRun', 'a run of 6 challenges with 3 lives; your best results stay on your machine (:ArcadeStats)'],
  [':ArcadeSync', 'download the community and AI challenges; it is manual, https-only and data only'],
  [':ArcadeDaily', "today's set: the AI-written challenges of the day when synced, a built-in set otherwise"],
  [':ArcadeAI', 'play the AI challenges (latest, or pick an area)'],
  [':ArcadeJoin ROOM-XXXX', 'play a challenge you just built here, no sign-in and no pull request'],
  [':ArcadeLogin', 'optional: sign in to send finished rounds to the leaderboard (:ArcadeAccount on|off, :ArcadeLogout)'],
]

const STEPS = [
  { n: '1', title: 'Play a round', text: 'A start buffer and a goal. Solve it any way you like; the game detects the win by itself.' },
  { n: '2', title: 'Read the lesson', text: 'Rank, points, a better way, your tools and your bad habits, in a short result window.' },
  { n: '3', title: 'Level up', text: 'Clear 80% of a run without game over and the next run starts harder. Daily and practice modes too.' },
]

function Band({ title, lead, children, id }: { title: string; lead?: string; children: ReactNode; id?: string }) {
  return (
    <Stack
      component="section"
      id={id}
      sx={{ gap: { xs: 3, md: 4 }, py: { xs: 5, md: 9 }, scrollMarginTop: 80, borderTop: 1, borderColor: 'divider' }}
    >
      <Box>
        <Typography variant="h4" component="h2" sx={{ fontSize: { xs: 24, md: 30 } }}>
          {title}
        </Typography>
        {lead && (
          <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: '60ch', lineHeight: 1.8 }}>
            {lead}
          </Typography>
        )}
      </Box>
      {children}
    </Stack>
  )
}

/** A static picture of what one round looks like. */
function RoundPreview() {
  const line = { fontFamily: 'inherit', fontSize: { xs: 12.5, sm: 14 }, lineHeight: 1.7, whiteSpace: 'pre' as const }
  return (
    <Paper sx={{ p: 0, overflow: 'hidden', bgcolor: '#101010', color: '#dcdcdc', borderColor: '#2a2a2a' }}>
      <Stack direction="row" sx={{ gap: 0.75, px: 1.5, py: 1, bgcolor: '#181818', alignItems: 'center' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#e0625a' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#e0b45a' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#7fb06a' }} />
        <Typography sx={{ ml: 1, fontSize: 12, color: '#9a9a9a' }}>arcade · run 1/6</Typography>
      </Stack>
      <Box sx={{ p: 2, overflowX: 'auto' }}>
        <Box sx={{ ...line, color: '#b4b96b' }}>Change inside quotes · level 1</Box>
        <Box sx={{ ...line, color: '#9a9a9a' }}>Replace the text inside the quotes with: new</Box>
        <Box sx={{ ...line, mt: 1.5 }}>
          <Box component="span" sx={{ color: '#6c6c6c' }}>1 </Box>name = "old value here"
        </Box>
        <Box sx={{ ...line, mt: 1.5, color: '#9a9a9a' }}>keys typed</Box>
        <Box sx={line}>ci"new&lt;Esc&gt;</Box>
        <Box sx={{ ...line, mt: 1.5 }}>
          <Box component="span" sx={{ bgcolor: '#b4b96b', color: '#101010', px: 1, fontWeight: 700 }}>RANK S</Box>
          {'  '}7 keys / par 7 · 3.1s · +210
        </Box>
        <Box sx={{ ...line, color: '#9a9a9a' }}>ci" changes everything between the quotes from anywhere on the line.</Box>
      </Box>
    </Paper>
  )
}

function Stat({ value, suffix, label }: { value: number | null; suffix?: string; label: string }) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 140 }}>
      <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }} color="primary">
        <CountUp value={value} suffix={suffix} />
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </Paper>
  )
}

export function HomePage() {
  const community = useCommunity()
  const stats = useStats()
  const published = community.status === 'ready' ? community.items : []
  return (
    <Box>
      <Box
        component="section"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' },
          gap: { xs: 4, lg: 8 },
          alignItems: 'center',
          py: { xs: 4, md: 8 },
        }}
      >
        <Box>
          <Typography variant="overline" color="primary">
            nvim-skill-arcade
          </Typography>
          <Typography variant="h1" sx={{ fontSize: 'clamp(32px, 5.5vw, 60px)', mt: 1, maxWidth: '18ch' }}>
            Train your Neovim. With your own keybinds.
          </Typography>
          <Typography sx={{ mt: 2.5, maxWidth: '58ch', opacity: 0.85, fontSize: { md: 17 } }}>
            A mini game for Neovim. Short rounds with a score, a clock and a streak, and after every round a lesson: a
            better way to do it, and which of your own plugins could have helped. Pure Lua, no dependencies.
          </Typography>
          <Stack direction="row" sx={{ gap: 1.5, mt: 3.5, flexWrap: 'wrap' }}>
            <Button variant="contained" size="large" onClick={() => navigate('terminal')}>
              Try the terminal
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('create')}>
              Create a challenge
            </Button>
            <Button
              variant="text"
              size="large"
              color="inherit"
              onClick={() => document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Install the plugin
            </Button>
          </Stack>
        </Box>
        <RoundPreview />
      </Box>

      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
        <Stat value={stats ? stats.builtin : null} label="built-in challenges" />
        <Stat value={AREAS.length} label="skill areas" />
        <Stat value={community.status === 'ready' ? published.length : null} label="community challenges" />
        <Stat value={stats && typeof stats.ai === 'number' ? stats.ai : null} label="AI challenges" />
        <Stat value={EXAMPLES.length} label="examples to start from" />
      </Stack>

      <Band title="How it plays" lead="Open :ArcadeMenu, start a run and play. The game only looks at the result, never at which keys you used.">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {STEPS.map((s) => (
            <Paper key={s.n} sx={{ p: 3.5, display: 'flex', gap: 2.5 }}>
              <Typography color="primary" sx={{ fontWeight: 800, fontSize: 40, lineHeight: 1 }}>
                {s.n}
              </Typography>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>{s.title}</Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {s.text}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Band>

      <Band title="What is in it">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
          {FEATURES.map((f) => (
            <Paper key={f.title} sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{f.title}</Typography>
              <Typography color="text.secondary" sx={{ flexGrow: 1, lineHeight: 1.8 }}>
                {f.text}
              </Typography>
              {f.to && (
                <Box>
                  <Button size="small" onClick={() => navigate(f.to!)}>
                    {f.cta}
                  </Button>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      </Band>

      <Band
        id="sign-in"
        title="Do you need to sign in?"
        lead="No. You can play, build and install everything without an account. Signing in with GitHub is an optional extra."
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
          <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>Why sign in with GitHub</Typography>
            <Stack component="ul" sx={{ gap: 1, pl: 2.5, m: 0 }}>
              {WHY_SIGN_IN.map((t) => (
                <Typography key={t} component="li" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t}
                </Typography>
              ))}
            </Stack>
            {authConfig && (
              <Box>
                <Button size="small" onClick={() => navigate('account')}>
                  Get a player code
                </Button>
              </Box>
            )}
          </Paper>
          <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>And in Neovim</Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
              The plugin works offline and keeps your results on your machine. If you want the leaderboard, run{' '}
              <code>:ArcadeLogin</code>: it shows a short code, you approve it in any browser, and then you choose whether
              finished rounds are sent automatically. It is optional, and you can turn it off or sign out any time. The commands:
            </Typography>
            <Stack spacing={1}>
              {IN_NEOVIM.map(([cmd, what]) => (
                <Stack key={cmd} direction="row" sx={{ gap: 1.5, alignItems: 'baseline' }}>
                  <Box component="code" sx={{ color: 'primary.main', whiteSpace: 'nowrap' }}>
                    {cmd}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {what}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Band>

      <Band title="Skill areas" lead="Restrict a run to the ones you want to improve.">
        <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
          {AREAS.map((a) => (
            <Chip key={a} variant="outlined" label={a} sx={{ height: 36, px: 0.5, fontSize: 14 }} />
          ))}
        </Stack>
      </Band>

      <Band
        id="install"
        title="Install"
        lead="lazy.nvim / LazyVim: add this spec, then run :ArcadeMenu. Change the key prefix freely; the menu shows whatever you map."
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.2fr) minmax(0, 0.8fr)' }, gap: 3, alignItems: 'start' }}>
          <CodeBlock label="lua/plugins/skill-arcade.lua" maxHeight={420}>
            {INSTALL}
          </CodeBlock>
          <Stack spacing={1}>
            {[
              [':ArcadeMenu', 'open the action menu'],
              [':ArcadeRun', 'start a run'],
              [':ArcadeSync', 'download the community challenges'],
              [':ArcadeTry', 'play a challenge file or a draft'],
              [':ArcadeJoin ROOM-XXXX', 'play a challenge made on this site'],
            ].map(([cmd, what]) => (
              <Stack key={cmd} direction="row" sx={{ gap: 1.5, alignItems: 'baseline' }}>
                <Box component="code" sx={{ color: 'primary.main', whiteSpace: 'nowrap' }}>
                  {cmd}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {what}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Band>

      <Band title="From the community" lead="Challenges anyone can add with a pull request.">
        {published.length === 0 ? (
          <Typography color="text.secondary">
            {community.status === 'loading' ? 'Loading...' : 'Nothing published yet. Yours could be the first.'}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {published.slice(0, 3).map((c) => (
              <Paper key={c.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{c.title}</Typography>
                <Stack direction="row" sx={{ gap: 0.5 }}>
                  <Chip size="small" variant="outlined" label={c.area} />
                  <Chip size="small" variant="outlined" label={`level ${c.level}`} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {c.brief}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
        <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => navigate('challenges')}>
            Browse all
          </Button>
          <Button variant="contained" onClick={() => navigate('create')}>
            Create a challenge
          </Button>
        </Stack>
      </Band>
    </Box>
  )
}
