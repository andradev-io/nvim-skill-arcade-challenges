import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { PLUGINS, pluginById, requestUrl } from '../plugins/registry'
import type { PluginInfo } from '../plugins/registry'
import { useKeymapStore } from '../store/keymapStore'
import { isOn, usePluginStore } from '../store/pluginStore'

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 2 }

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {sub && (
        <Typography sx={{ opacity: 0.75, mt: 0.5, mb: 2, maxWidth: 820 }}>{sub}</Typography>
      )}
      {!sub && <Box sx={{ mb: 2 }} />}
      {children}
    </Box>
  )
}

const OPEN = { target: '_blank', rel: 'noopener noreferrer' } as const

function PluginCard({ p, inConfig, on }: { p: PluginInfo; inConfig: boolean; on: boolean }) {
  const works = p.status !== 'unsupported'
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, borderColor: inConfig ? 'primary.main' : undefined }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
        <Chip size="small" color={p.status === 'supported' ? 'success' : p.status === 'partial' ? 'warning' : 'default'} variant={works ? 'filled' : 'outlined'} label={p.status === 'supported' ? 'works' : p.status === 'partial' ? 'partly works' : 'not possible'} />
        {inConfig && <Chip size="small" variant="outlined" color="primary" label="in your config" />}
        {works && inConfig && !on && <Chip size="small" variant="outlined" label="switched off" />}
      </Stack>
      <Typography variant="body2" sx={{ opacity: 0.85 }}>
        {p.note}
      </Typography>
      {p.keys && (
        <Typography variant="body2" component="code" sx={{ fontSize: 12.5 }}>
          {p.keys}
        </Typography>
      )}
      <Typography variant="caption" sx={{ opacity: 0.6 }}>
        {p.repos.join(' · ')}
      </Typography>
      <Box sx={{ mt: 'auto', pt: 0.5 }}>
        {works ? (
          <Link href={requestUrl(p.name, 'bug')} {...OPEN} variant="body2">
            Something does not behave? Tell us
          </Link>
        ) : (
          <Link href={requestUrl(p.name)} {...OPEN} variant="body2">
            Ask for a version of this
          </Link>
        )}
      </Box>
    </Paper>
  )
}

/** What the browser terminal can and cannot do: plugins, the user's loaded config, and a way to ask for more. */
export function SupportPage() {
  const km = useKeymapStore()
  const pl = usePluginStore()
  const stubs = km.maps.filter((m) => m.note)
  const loaded = km.maps.length > 0 || km.skipped.length > 0 || pl.detected.length > 0 || pl.unknown.length > 0
  const detected = pl.detected.map(pluginById).filter((p): p is PluginInfo => !!p)

  // stubs grouped by what they need
  const need = new Map<string, number>()
  for (const m of stubs) {
    const what = (m.note ?? '').replace(/^[^:]*: /, '').replace(/, not simulated.*$/, '')
    need.set(what, (need.get(what) ?? 0) + 1)
  }
  const needList = [...need.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  const skippedBy = new Map<string, number>()
  for (const k of km.skipped) skippedBy.set(k.reason, (skippedBy.get(k.reason) ?? 0) + 1)

  return (
    <Box sx={{ py: { xs: 2, md: 4 } }}>
      <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 44 } }}>
        What works in the terminal
      </Typography>
      <Typography sx={{ mt: 1.5, maxWidth: 820, opacity: 0.85 }}>
        The terminal is a Vim in the browser, not your Neovim. Your key mappings and ex commands run for real. Popular plugins
        are imitated where that is possible, and the rest are listed here with the reason. Missing something? Ask for it.
      </Typography>
      <Stack direction="row" sx={{ gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" href={requestUrl('')} {...OPEN}>
          Request plugin support
        </Button>
        <Button variant="outlined" href="#/terminal">
          Open the terminal
        </Button>
      </Stack>

      {loaded && (
        <Section
          title="Your config"
          sub={`Read from ${km.source || 'your last load'}. Nothing was run: the files are only scanned.`}
        >
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip color="success" label={`${km.maps.length - stubs.length} mappings work`} />
            {stubs.length > 0 && <Chip color="info" variant="outlined" label={`${stubs.length} need a plugin or Lua`} />}
            {km.skipped.length > 0 && <Chip color="warning" variant="outlined" label={`${km.skipped.length} skipped`} />}
            <Chip variant="outlined" label={`${detected.length} known plugins`} />
            {pl.unknown.length > 0 && <Chip variant="outlined" label={`${pl.unknown.length} not in the list yet`} />}
          </Stack>
          {detected.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Plugins from your config that we know</Typography>
              <Box sx={GRID}>
                {detected.map((p) => (
                  <PluginCard key={p.id} p={p} inConfig on={isOn(pl, p.id)} />
                ))}
              </Box>
            </>
          )}
          {pl.unknown.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, mt: 3, mb: 0.5 }}>Plugins in your config that are not in the list yet</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mb: 1.5 }}>
                They are probably not simulated. Pick the ones you use a lot and ask for them.
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {pl.unknown.map((r) => (
                  <Chip key={r} component="a" clickable href={requestUrl(r)} {...OPEN} variant="outlined" label={r} />
                ))}
              </Stack>
            </>
          )}
          {needList.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, mt: 3, mb: 1 }}>Keys that only say what they would do</Typography>
              <Stack spacing={0.25} sx={{ fontSize: 13.5 }}>
                {needList.map(([what, n]) => (
                  <Box key={what}>
                    <Box component="span" sx={{ opacity: 0.6 }}>
                      {n}×{' '}
                    </Box>
                    {what}
                  </Box>
                ))}
              </Stack>
            </>
          )}
          {skippedBy.size > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, mt: 3, mb: 1 }}>Skipped</Typography>
              <Stack spacing={0.25} sx={{ fontSize: 13.5 }}>
                {[...skippedBy.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12)
                  .map(([why, n]) => (
                    <Box key={why}>
                      <Box component="span" sx={{ opacity: 0.6 }}>
                        {n}×{' '}
                      </Box>
                      {why}
                    </Box>
                  ))}
              </Stack>
            </>
          )}
        </Section>
      )}

      <Section title="Plugins that work" sub="Written for this editor. They cover the common keys, not every option.">
        <Box sx={GRID}>
          {PLUGINS.filter((p) => p.status !== 'unsupported').map((p) => (
            <PluginCard key={p.id} p={p} inConfig={pl.detected.includes(p.id)} on={isOn(pl, p.id)} />
          ))}
        </Box>
      </Section>

      <Section title="Plugins that cannot work here" sub="They need a machine (files, a shell, language servers, a git repository), or they only draw on a screen. Their keys are still taken over and say what they would do.">
        <Box sx={GRID}>
          {PLUGINS.filter((p) => p.status === 'unsupported').map((p) => (
            <PluginCard key={p.id} p={p} inConfig={pl.detected.includes(p.id)} on={false} />
          ))}
        </Box>
      </Section>

      <Section title="Keymaps and commands">
        <Box sx={GRID}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Works</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Key mappings in normal, insert and visual mode (<code>vim.keymap.set</code>, <code>vim.api.nvim_set_keymap</code>, Vimscript <code>map</code>), the leader key, and these commands: <code>:tabnew</code> <code>:tabclose</code> <code>:tabn</code> <code>:tabp</code> <code>:bn</code> <code>:bp</code> <code>:bd</code> <code>:m</code> <code>:echo</code> <code>:q</code> <code>:w</code> and the usual editing commands. A Lua function that only runs <code>vim.cmd("...")</code> counts as that command.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Takes the key, says what it would do</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Mappings that call a plugin command (<code>:Telescope</code>, <code>:NvimTreeToggle</code>, <code>:LazyGit</code> ...) or run Lua that needs Neovim itself. Window commands (<code>:split</code>, <code>:resize</code>) are accepted but there are no windows.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Skipped</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Terminal-mode and command-line mappings, and anything the scanner cannot read as plain text (keys built from variables or loops). The config is never executed.
            </Typography>
          </Paper>
        </Box>
      </Section>
    </Box>
  )
}
