import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useState } from 'react'
import { fileCommand, joinCommand } from '../../core/roomCode'
import { downloadText, useClipboard } from '../../hooks/useClipboard'
import { useDraft } from '../../hooks/useDraft'

const FOLDER_KEY = 'arcade-folder'

function loadFolder(): string {
  try {
    return localStorage.getItem(FOLDER_KEY) || '~/Downloads'
  } catch {
    return '~/Downloads'
  }
}

function Command({ text }: { text: string }) {
  return (
    <Box
      component="code"
      sx={{
        flex: '1 1 220px',
        p: '9px 12px',
        border: 1,
        borderColor: 'divider',
        borderRadius: '15px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        fontSize: 13,
      }}
    >
      {text}
    </Box>
  )
}

export function JoinBox() {
  const { data, ok, code } = useDraft()
  const [folder, setFolder] = useState(loadFolder)
  const room = useClipboard()
  const file = useClipboard()
  const fileCmd = fileCommand(folder, data.id)

  const onFolder = (v: string) => {
    setFolder(v)
    try {
      localStorage.setItem(FOLDER_KEY, v)
    } catch {
      /* private mode */
    }
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        Your draft gets a <b>room code</b>. Paste it in Neovim and play with your own keybinds and plugins. Nothing is
        saved: no points, bests or stats. The code carries the whole draft, so there is no upload and nothing to clean up.
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "stretch" }}>
        <Command text={joinCommand(code)} />
        <Button variant="contained" disabled={!ok} onClick={() => room.copy(joinCommand(code))}>
          {room.copied ? 'Copied' : 'Copy command'}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {ok
          ? `Room code: ${code.length} characters. Needs a nvim-skill-arcade version with :ArcadeJoin (update the plugin if the command is missing).`
          : 'Fix the errors in the form first: Neovim refuses drafts that break the safety schema.'}
      </Typography>
      <Accordion disableGutters variant="outlined" sx={{ borderRadius: '10px !important' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" color="primary">
            Prefer a file?
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label="Folder where the downloaded file lands"
              value={folder}
              onChange={(e) => onFolder(e.target.value)}
              slotProps={{ htmlInput: { spellCheck: false } }}
            />
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Command text={fileCmd} />
              <Button
                variant="outlined"
                disabled={!ok}
                onClick={() => {
                  downloadText(`${data.id || 'challenge'}.json`, JSON.stringify(data, null, 2) + '\n')
                  file.copy(fileCmd)
                }}
              >
                {file.copied ? 'Downloaded, command copied' : 'Download file + copy command'}
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}
