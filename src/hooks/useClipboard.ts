import { useCallback, useState } from 'react'

/** copy(text) puts text on the clipboard; `copied` is true for a moment afterwards. */
export function useClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const t = document.createElement('textarea')
      t.value = text
      document.body.appendChild(t)
      t.select()
      try {
        document.execCommand('copy')
      } catch {
        /* nothing else to try */
      }
      document.body.removeChild(t)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }, [])
  return { copy, copied }
}

export function downloadText(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
