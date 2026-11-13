import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import type { KeyboardEvent } from 'react'
import type { Tab } from '../../store/terminalStore'

const BG = 'var(--t-bg)'
const LINE = '1px solid var(--t-line)'

interface TabBarProps {
  tabs: Tab[]
  activeTab: number
  onGoTab: (index: number) => void
  onCloseTab: (index: number) => void
  onNewTab: () => void
}

function tabKey(e: KeyboardEvent<HTMLElement>, i: number, length: number, goTab: (index: number) => void) {
  const to =
    e.key === 'ArrowRight' ? (i + 1) % length
    : e.key === 'ArrowLeft' ? (i - 1 + length) % length
    : e.key === 'Home' ? 0
    : e.key === 'End' ? length - 1
    : -1
  if (to < 0) return
  e.preventDefault()
  goTab(to)
}

/** Renders the buffer tab strip with keyboard navigation and close buttons. */
export function TabBar({ tabs, activeTab, onGoTab, onCloseTab, onNewTab }: TabBarProps) {
  return (
    <Stack direction="row" role="tablist" aria-label="Buffers" sx={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
      {tabs.map((t, i) => (
        <Stack
          key={t.id}
          direction="row"
          sx={{
            alignItems: 'center',
            fontSize: 13,
            whiteSpace: 'nowrap',
            bgcolor: i === activeTab ? BG : 'transparent',
            opacity: i === activeTab ? 1 : 0.6,
            borderRight: LINE,
            borderTop: `2px solid ${i === activeTab ? 'var(--t-accent)' : 'transparent'}`,
          }}
        >
          <ButtonBase
            role="tab"
            aria-selected={i === activeTab}
            tabIndex={i === activeTab ? 0 : -1}
            onClick={() => i !== activeTab && onGoTab(i)}
            onKeyDown={(e) => tabKey(e, i, tabs.length, onGoTab)}
            sx={{ pl: 1.5, pr: tabs.length > 1 ? 0.5 : 1.5, py: 0.75, fontSize: 13, fontFamily: 'inherit', color: 'inherit' }}
          >
            {t.name}
          </ButtonBase>
          {tabs.length > 1 && (
            <IconButton size="small" aria-label={`Close ${t.name}`} onClick={() => onCloseTab(i)} sx={{ color: 'inherit', p: 0.25, mr: 0.5 }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Stack>
      ))}
      <IconButton size="small" aria-label="New tab" onClick={onNewTab} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
        <AddIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  )
}