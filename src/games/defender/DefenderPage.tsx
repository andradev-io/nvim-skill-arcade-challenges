import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import { readThemeColors } from '../engine/theme'
import { DefenderGame } from './DefenderGame'
import type { GameState } from '../engine/types'
import { useArcadeStore } from '../../store/arcadeStore'

export function DefenderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<DefenderGame | null>(null)
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    wave: 1,
    isRunning: false,
    isPaused: false,
    isGameOver: false,
  })
  const saveScore = useArcadeStore((s) => s.saveScore)

  // Initialize game on mount
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const colors = readThemeColors()
    const game = new DefenderGame({
      canvas,
      colors,
      onStateChange: (state) => setGameState({ ...state }),
      onGameOver: (finalScore) => {
        const wave = game.getState().wave
        saveScore('defender', wave, finalScore)
      },
    })

    // Wire up keyboard shortcut callbacks
    game.onNavigateBack = () => {
      window.location.hash = '#/arcade'
    }
    game.onRequestStart = () => {
      if (game.getState().isGameOver) {
        // Restart: stop and start fresh
        game.stop()
      }
      game.start()
      container.focus()
    }
    game.onRequestReset = () => {
      game.stop()
      setGameState({
        score: 0,
        lives: 3,
        wave: 1,
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
  }, [saveScore])

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
    setGameState({
      score: 0,
      lives: 3,
      wave: 1,
      isRunning: false,
      isPaused: false,
      isGameOver: false,
    })
  }

  const handleBack = () => {
    gameRef.current?.stop()
    window.location.hash = '#/arcade'
  }

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
          Vim Defender
        </Typography>
        <Button variant="outlined" size="small" onClick={handleBack}>
          Back to Arcade
        </Button>
      </Stack>

      <Paper
        elevation={2}
        sx={{
          p: 1,
          display: 'flex',
          gap: 3,
          fontFamily: 'monospace',
          fontSize: 14,
          bgcolor: 'background.paper',
        }}
      >
        <span>Wave: {gameState.wave}</span>
        <span>Score: {gameState.score}</span>
        <span>Lives: {gameState.lives}</span>
        <span>{gameState.isPaused ? 'PAUSED' : gameState.isGameOver ? 'GAME OVER' : gameState.isRunning ? 'PLAYING' : 'READY'}</span>
      </Paper>

      <Box
        ref={containerRef}
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
            Start Game
          </Button>
        )}
        {(gameState.isRunning || gameState.isGameOver) && (
          <Button variant="outlined" onClick={handleReset}>
            Reset
          </Button>
        )}
      </Stack>

      <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', fontFamily: 'monospace' }}>
        Type vim commands to destroy enemies &middot; ESC: pause/resume &middot; R: reset
      </Typography>
    </Stack>
  )
}