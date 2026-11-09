import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useCommunity } from '../../hooks/useCommunity'
import { Section } from '../common/Section'

export function PublishedList() {
  const community = useCommunity()
  const [filter, setFilter] = useState('')
  const items = community.status === 'ready' ? community.items : []
  const f = filter.toLowerCase()
  const shown = items.filter((c) => !f || [c.title, c.area, c.author ?? ''].join(' ').toLowerCase().includes(f))
  const count =
    community.status === 'loading'
      ? 'loading...'
      : community.status === 'error'
        ? 'list unavailable offline'
        : items.length
          ? `${shown.length} of ${items.length}`
          : 'nothing published yet'

  return (
    <Section title="Published challenges">
      <TextField size="small" label="Filter by title, area or author" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Typography variant="caption" color="text.secondary">{count}</Typography>
      <List dense disablePadding sx={{ maxHeight: 300, overflow: 'auto' }}>
        {shown.map((c) => (
          <ListItem key={c.id} divider disableGutters>
            <ListItemText
              primary={c.title}
              secondary={`${c.area} - level ${c.level}${c.author ? ` - by ${c.author}` : ''}`}
              slotProps={{ primary: { sx: { fontWeight: 700 } } }}
            />
          </ListItem>
        ))}
      </List>
      <Divider />
      <Typography variant="caption" color="text.secondary">
        In Neovim: :ArcadeSync downloads them. They join your runs and practice, marked as community.
      </Typography>
    </Section>
  )
}
