import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_WIDTH, MIN_WIDTH, useTerminalLayout } from './terminalLayoutStore'

describe('terminal menu layout', () => {
  beforeEach(() => {
    localStorage.clear()
    useTerminalLayout.setState({ side: 'left', width: 330, open: true })
  })

  it('keeps the width between the limits', () => {
    useTerminalLayout.getState().setWidth(10)
    expect(useTerminalLayout.getState().width).toBe(MIN_WIDTH)
    useTerminalLayout.getState().setWidth(5000)
    expect(useTerminalLayout.getState().width).toBe(MAX_WIDTH)
  })

  it('toggles and swaps sides, and remembers them', () => {
    useTerminalLayout.getState().toggle()
    useTerminalLayout.getState().swapSide()
    useTerminalLayout.getState().setWidth(400)
    const saved = JSON.parse(localStorage.getItem('arcade-terminal-layout') ?? '{}') as Record<string, unknown>
    expect(saved).toEqual({ side: 'right', width: 400, open: false })
  })
})
