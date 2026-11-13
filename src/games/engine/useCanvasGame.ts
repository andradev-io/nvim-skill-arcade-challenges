import { useEffect, useRef, useState } from 'react'
import { readThemeColors } from './theme'
import type { GameConfig, GameEngine, GameState } from './types'

const INITIAL_STATE: GameState = {
  score: 0,
  lives: 1,
  wave: 0,
  isRunning: false,
  isPaused: false,
  isGameOver: false,
}

interface UseCanvasGameOptions<T extends GameEngine> {
  createGame: (config: GameConfig) => T
  onSaveScore?: (score: number) => void
  onNavigateBack?: () => void
  /** Override initial game state (e.g. Defender starts with 3 lives, wave 1). */
  initialState?: GameState
  /** Called after game creation for extra setup (e.g. loading a level). */
  onInit?: (game: T) => void
  /** Called when the user requests a reset; receives the game so the caller can reload levels etc. */
  onReset?: (game: T) => void
  /** Called when the user requests start while game-over; receives the game so the caller can reload. */
  onRestart?: (game: T) => void
}

export interface CanvasGameHandle<T extends GameEngine> {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  gameRef: React.MutableRefObject<T | null>
  gameState: GameState
  start: () => void
  reset: () => void
}

export function useCanvasGame<T extends GameEngine>(options: UseCanvasGameOptions<T>): CanvasGameHandle<T> {
  const { createGame, onSaveScore, onNavigateBack, initialState, onInit, onReset, onRestart } = options
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<T | null>(null)
  const [gameState, setGameState] = useState<GameState>(initialState ?? INITIAL_STATE)

  // Stable refs for callbacks that close over mutable values
  const onSaveScoreRef = useRef(onSaveScore)
  onSaveScoreRef.current = onSaveScore
  const onNavigateBackRef = useRef(onNavigateBack)
  onNavigateBackRef.current = onNavigateBack
  const onInitRef = useRef(onInit)
  onInitRef.current = onInit
  const onResetRef = useRef(onReset)
  onResetRef.current = onReset
  const onRestartRef = useRef(onRestart)
  onRestartRef.current = onRestart
  const initialStateRef = useRef(initialState ?? INITIAL_STATE)
  initialStateRef.current = initialState ?? INITIAL_STATE

  // Initialize game on mount
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const colors = readThemeColors()
    const game = createGame({
      canvas,
      colors,
      onStateChange: (state) => setGameState({ ...state }),
      onGameOver: (finalScore) => {
        onSaveScoreRef.current?.(finalScore)
      },
    })

    onInitRef.current?.(game)

    game.onNavigateBack = () => {
      onNavigateBackRef.current?.()
    }
    game.onRequestStart = () => {
      if (game.getState().isGameOver) {
        onRestartRef.current?.(game)
      }
      game.start()
      container.focus()
    }
    game.onRequestReset = () => {
      game.stop()
      onResetRef.current?.(game)
      setGameState({ ...initialStateRef.current })
    }

    gameRef.current = game
    container.focus()

    return () => {
      game.stop()
      game.onNavigateBack = null
      game.onRequestStart = null
      game.onRequestReset = null
      gameRef.current = null
    }
  }, [createGame])

  // Update theme colors when they change
  useEffect(() => {
    const colors = readThemeColors()
    gameRef.current?.setColors(colors)
  }, [])

  const start = () => {
    gameRef.current?.start()
    containerRef.current?.focus()
  }

  const reset = () => {
    const game = gameRef.current
    if (!game) return
    game.stop()
    onResetRef.current?.(game)
    setGameState({ ...initialStateRef.current })
  }

  return { canvasRef, containerRef, gameRef, gameState, start, reset }
}