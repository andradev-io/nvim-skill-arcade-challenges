export type KeyHandler = (code: string, event: KeyboardEvent) => void

/**
 * Layout-independent keyboard input manager using KeyboardEvent.code.
 * Maps vim-style h/j/k/l to lane indices 0-3 for grid-based games.
 */
export class InputManager {
  private handler: KeyHandler | null = null
  private bound = false

  /** Map KeyH/KeyJ/KeyK/KeyL to lane indices 0-3. Returns -1 for unmapped keys. */
  static codeToLane(code: string): number {
    switch (code) {
      case 'KeyH': return 0
      case 'KeyJ': return 1
      case 'KeyK': return 2
      case 'KeyL': return 3
      default: return -1
    }
  }

  setHandler(handler: KeyHandler | null): void {
    this.handler = handler
  }

  bind(target: HTMLElement): void {
    if (this.bound) return
    target.addEventListener('keydown', this.onKeyDown)
    this.bound = true
  }

  unbind(target: HTMLElement): void {
    target.removeEventListener('keydown', this.onKeyDown)
    this.bound = false
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    // Let browser handle tab, F-keys, and modifier combos
    if (event.key === 'Tab') return
    if (event.key.startsWith('F') && event.key.length > 1) return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    // Prevent default scrolling for game keys
    const gameKeys = new Set(['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Space', 'Enter', 'Escape'])
    if (gameKeys.has(event.code)) {
      event.preventDefault()
    }

    this.handler?.(event.code, event)
  }
}