import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <Paper id={id} component="section" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" sx={{ fontSize: 15, mb: 1.5 }}>
        {title}
      </Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Paper>
  )
}
