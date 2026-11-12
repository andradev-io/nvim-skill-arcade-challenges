import { useMemo } from 'react'
import { CommandPalette, type PaletteItem } from '../terminal/CommandPalette'
import type { PickerConfig } from '../../core/types'

interface PickerOverlayProps {
  open: boolean
  config: PickerConfig | null
  onSelect: (index: number, item: PickerConfig['items'][number]) => void
  onClose: () => void
}

/** Adapter that renders a challenge-provided picker config through the existing CommandPalette UI. */
export function PickerOverlay({ open, config, onSelect, onClose }: PickerOverlayProps) {
  const items: PaletteItem[] = useMemo(() => {
    if (!config) return []
    return config.items.map((it, i) => ({
      id: `picker-${i}`,
      label: it.label,
      group: config.type ?? 'find_files',
      hint: it.content ?? (it.line !== undefined ? `L${it.line}` : undefined),
      run: () => onSelect(i, it),
    }))
  }, [config, onSelect])

  return <CommandPalette open={open} items={items} onClose={onClose} placeholder={config?.prompt} />
}