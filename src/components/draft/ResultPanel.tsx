import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useDraft } from '../../hooks/useDraft'
import { downloadText, useClipboard } from '../../hooks/useClipboard'
import { CodeBlock } from '../common/CodeBlock'

export function ResultPanel() {
  const { data, errors, json, ok, prUrl, prTooLong } = useDraft()
  const { copy, copied } = useClipboard()
  return (
    <Stack spacing={1.5}>
      {ok ? (
        <Alert severity="success">Looks valid. CI will replay your solution in Neovim.</Alert>
      ) : (
        <Alert severity="warning">
          <Stack component="ul" sx={{ m: 0, pl: 2 }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </Stack>
        </Alert>
      )}
      <CodeBlock>{json}</CodeBlock>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button variant="outlined" onClick={() => copy(json)}>
          {copied ? 'Copied' : 'Copy JSON'}
        </Button>
        <Button variant="outlined" onClick={() => downloadText(`${data.id || 'challenge'}.json`, json)}>
          Download file
        </Button>
        <Button
          variant="contained"
          disabled={!prUrl}
          {...(prUrl ? { href: prUrl, target: '_blank', rel: 'noopener' } : {})}
          title={prTooLong ? 'Too long for a link: use Copy JSON' : undefined}
        >
          Submit as pull request
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 1.5 }}>
        Submit opens GitHub's new-file page prefilled with this challenge; GitHub forks the repo and opens a pull request
        for you. CI replays your reference solution (must fail at the start and pass after your keys) and a maintainer
        reviews it. If the link is too long, use Copy JSON and add challenges/&lt;id&gt;.json yourself.
      </Typography>
    </Stack>
  )
}
