import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import type { DraftForm } from '../../core/types'
import { useDraftStore } from '../../store/draftStore'

type TextKey = { [K in keyof DraftForm]: DraftForm[K] extends string ? K : never }[keyof DraftForm]

interface FieldProps {
  field: TextKey
  label: string
  placeholder?: string
  helper?: string
  multiline?: boolean
  rows?: number
  type?: 'text' | 'number'
  max?: number
  /** Select options; an empty value is shown as `blank`. */
  options?: string[]
  blank?: string
}

/** A text / number / select input bound to one field of the draft form. */
export function Field({ field, label, placeholder, helper, multiline, rows, type, max, options, blank }: FieldProps) {
  const value = useDraftStore((s) => s.form[field])
  const set = useDraftStore((s) => s.set)
  return (
    <TextField
      select={!!options}
      size="small"
      fullWidth
      label={label}
      value={value}
      onChange={(e) => set(field, e.target.value)}
      placeholder={placeholder}
      helperText={helper}
      multiline={multiline}
      minRows={rows}
      type={options ? undefined : type}
      slotProps={{
        htmlInput: { maxLength: max, spellCheck: false },
        inputLabel: { shrink: options || placeholder || type === 'number' ? true : undefined },
      }}
    >
      {options?.map((o) => (
        <MenuItem key={o} value={o}>
          {o === '' ? (blank ?? 'none') : o}
        </MenuItem>
      ))}
    </TextField>
  )
}
