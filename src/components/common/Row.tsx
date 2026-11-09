import Box from '@mui/material/Box'
import type { ReactNode } from 'react'

/** Responsive row of equal-width inputs. */
export function Row({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1.5 }}>
      {children}
    </Box>
  )
}
