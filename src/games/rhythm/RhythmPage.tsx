import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import { readThemeColors } from '../engine/theme'
import { RHYTHM_LEVELS } from './levels'
import { RhythmGame } from './RhythmGame'
import type { GameState } from '../engine/types'
import { useArcadeStore } from '../../store/arcadeStore'

export function RhythmPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<RhythmGame | null>(null)
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
    const game = new RhythmGame({
      canvas,
      colors,
      onStateChange: (state) => setGameState({ ...state }),
      onGameOver: (finalScore) => {
        saveScore('rhythm', levelIndex + 1, finalScore)
      },
    })

    game.loadLevel(RHYTHM_LEVELS[levelIndex])

    // Wire up keyboard shortcut callbacks
    game.onNavigateBack = () => {
      window.location.hash = '#/arcade'
    }
    game.onRequestStart = () => {
      if (game.getState().isGameOver) {
        // Restart: reload current level and start
        game.loadLevel(RHYTHM_LEVELS[levelIndex])
      }
      game.start()
      container.focus()
    }
    game.onRequestReset = () => {
      game.stop()
      game.loadLevel(RHYTHM_LEVELS[levelIndex])
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
    gameRef.current?.loadLevel(RHYTHM_LEVELS[levelIndex])
    setGameState({
      score: 0,
      lives: 1,
      wave: 0,
      isRunning: false,
      isPaused: false,
      isGameOver: false,
    })
  }

  const handleBack = () => {
    gameRef.current?.stop()
    window.location.hash = '#/arcade'
  }

  const currentLevel = RHYTHM_LEVELS[levelIndex]

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
          Vim Rhythm: {currentLevel.name}
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
          alignItems: 'center',
        }}
      >
        <Select
          value={levelIndex}
          onChange={(e) => setLevelIndex(Number(e.target.value))}
          size="small"
          disabled={gameState.isRunning && !gameState.isPaused}
          sx={{ fontFamily: 'monospace', fontSize: 14, minWidth: 160 }}
        >
          {RHYTHM_LEVELS.map((level, idx) => (
            <MenuItem key={level.id} value={idx}>
              {level.name} ({level.bpm} BPM)
            </MenuItem>
          ))}
        </Select>
        <span>Score: {gameState.score}</span>
        <span>BPM: {currentLevel.bpm}</span>
        <span>{gameState.isPaused ? 'PAUSED' : gameState.isGameOver ? 'COMPLETE' : gameState.isRunning ? 'RUNNING' : 'READY'}</span>
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
            Start Song
          </Button>
        )}
        {(gameState.isRunning || gameState.isGameOver) && (
          <Button variant="outlined" onClick={handleReset}>
            Reset
          </Button>
        )}
      </Stack>

      <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', fontFamily: 'monospace' }}>
        Press h/j/k/l when notes reach the line &middot; ESC: pause/resume
      </Typography>
    </Stack>
  )
}