import Box from '@mui/material/Box'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
  maxHeight?: number
}

/** Monospace block for JSON, buffers and commands. */
export function CodeBlock({ children, label, maxHeight = 320 }: Props) {
  return (
    <Box>
      {label && (
        <Box component="span" sx={{ fontSize: 12, color: 'primary.main', display: 'block', mb: 0.5 }}>
          {label}
        </Box>
      )}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          fontFamily: 'inherit',
          fontSize: 12.5,
          overflow: 'auto',
          maxHeight,
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
