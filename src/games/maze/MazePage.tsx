import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import { readThemeColors } from '../engine/theme'
import { MAZE_LEVELS } from './levels'
import { MazeGame } from './MazeGame'
import type { GameState } from '../engine/types'
import { useArcadeStore } from '../../store/arcadeStore'

export function MazePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<MazeGame | null>(null)
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 1,
    wave: 0,
    isRunning: false,
    isPaused: false,
    isGameOver: false,
  })
  const [levelIndex, setLevelIndex] = useState(0)
  const saveScore = useArcadeStore((s) => s.saveScore)

  // Initialize game on mount
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const colors = readThemeColors()
    const game = new MazeGame({
      canvas,
      colors,
      onStateChange: (state) => setGameState({ ...state }),
      onGameOver: (finalScore) => {
        saveScore('maze', levelIndex + 1, finalScore)
      },
    })

    game.loadLevel(MAZE_LEVELS[levelIndex])

    // Wire up keyboard shortcut callbacks
    game.onNavigateBack = () => {
      window.location.hash = '#/arcade'
    }
    game.onRequestStart = () => {
      if (game.getState().isGameOver) {
        // Restart: reload current level and start
        game.loadLevel(MAZE_LEVELS[levelIndex])
      }
      game.start()
      container.focus()
    }
    game.onRequestReset = () => {
      game.stop()
      game.loadLevel(MAZE_LEVELS[levelIndex])
      setGameState({
        score: 0,
        lives: 1,
        wave: 0,
        isRunning: false,
        isPaused: false,
        isGameOver: false,
      })
    }

    gameRef.current = game

    // Focus container for keyboard input
    container.focus()

    return () => {
      game.stop()
      game.onNavigateBack = null
      game.onRequestStart = null
      game.onRequestReset = null
      gameRef.current = null
    }
  }, [levelIndex, saveScore])

  // Update theme colors when they change
  useEffect(() => {
    const colors = readThemeColors()
    gameRef.current?.setColors(colors)
  }, [])

  const handleStart = () => {
    gameRef.current?.start()
    containerRef.current?.focus()
  }

  const handleReset = () => {
    gameRef.current?.stop()
    gameRef.current?.loadLevel(MAZE_LEVELS[levelIndex])
    setGameState({
      score: 0,
      lives: 1,
      wave: 0,
      isRunning: false,
      isPaused: false,
      isGameOver: false,
    })
  }

  const handleNextLevel = () => {
    if (levelIndex < MAZE_LEVELS.length - 1) {
      setLevelIndex((i) => i + 1)
    }
  }

  const handleBack = () => {
    gameRef.current?.stop()
    window.location.hash = '#/arcade'
  }

  const currentLevel = MAZE_LEVELS[levelIndex]

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
          Vim Maze: {currentLevel.name}
        </Typography>
        <Button variant="outlined" size="small" onClick={handleBack}>
          Back to Arcade
        </Button>
      </Stack>

      <Paper
        elevation={2}
        aria-live="polite"
        sx={{
          p: 1,
          display: 'flex',
          gap: 3,
          fontFamily: 'monospace',
          fontSize: 14,
          bgcolor: 'background.paper',
        }}
      >
        <span>Level: {levelIndex + 1}/{MAZE_LEVELS.length}</span>
        <span>Score: {gameState.score}</span>
        <span>Par: {currentLevel.parSeconds}s</span>
        <span>{gameState.isPaused ? 'PAUSED' : gameState.isGameOver ? 'COMPLETE' : gameState.isRunning ? 'RUNNING' : 'READY'}</span>
      </Paper>

      <Box
        ref={containerRef}
        role="application"
        aria-label="Vim Maze game area: use h/j/k/l to move, type commands for doors"
        tabIndex={0}
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          '&:focus': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ imageRendering: 'pixelated' }}
        />
      </Box>

      <Stack direction="row" sx={{ justifyContent: 'center', gap: 2 }}>
        {!gameState.isRunning && !gameState.isGameOver && (
          <Button variant="contained" onClick={handleStart}>
            Start Level
          </Button>
        )}
        {(gameState.isRunning || gameState.isGameOver) && (
          <Button variant="outlined" onClick={handleReset}>
            Reset
          </Button>
        )}
        {gameState.isGameOver && levelIndex < MAZE_LEVELS.length - 1 && (
          <Button variant="contained" onClick={handleNextLevel}>
            Next Level
          </Button>
        )}
      </Stack>

      <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', fontFamily: 'monospace' }}>
        Move: h/j/k/l &middot; Doors: type the command shown &middot; ESC: pause/resume
      </Typography>
    </Stack>
  )
}