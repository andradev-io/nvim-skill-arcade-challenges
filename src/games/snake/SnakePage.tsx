import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useState } from 'react'
import { SNAKE_LEVELS } from './levels'
import { SnakeGame } from './SnakeGame'
import type { GameConfig } from '../engine/types'
import { useCanvasGame } from '../engine/useCanvasGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'

export function SnakePage() {
  const [levelIndex, setLevelIndex] = useState(0)
  const saveScore = useArcadeStore((s) => s.saveScore)

  const createGame = useCallback((config: GameConfig) => new SnakeGame(config), [])

  const { canvasRef, containerRef, gameRef, gameState, start, reset } = useCanvasGame({
    createGame,
    initialState: { score: 0, lives: 1, wave: 0, isRunning: false, isPaused: false, isGameOver: false },
    onSaveScore: (score) => saveScore('snake', levelIndex + 1, score),
    onNavigateBack: () => navigate('arcade'),
    onInit: (game) => game.loadLevel(SNAKE_LEVELS[levelIndex]),
    onReset: (game) => game.loadLevel(SNAKE_LEVELS[levelIndex]),
    onRestart: (game) => game.loadLevel(SNAKE_LEVELS[levelIndex]),
  })

  const handleLevelChange = (newIndex: number) => {
    gameRef.current?.stop()
    setLevelIndex(newIndex)
  }

  const handleBack = () => {
    gameRef.current?.stop()
    navigate('arcade')
  }

  const currentLevel = SNAKE_LEVELS[levelIndex]

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
          Vim Snake: {currentLevel.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Select
            value={levelIndex}
            size="small"
            onChange={(e) => handleLevelChange(Number(e.target.value))}
            sx={{ fontFamily: 'monospace', fontSize: 14 }}
          >
            {SNAKE_LEVELS.map((lvl, i) => (
              <MenuItem key={lvl.id} value={i}>{lvl.name}</MenuItem>
            ))}
          </Select>
          <Button variant="outlined" size="small" onClick={handleBack}>
            Back to Arcade
          </Button>
        </Stack>
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
        <span>Level: {levelIndex + 1}/{SNAKE_LEVELS.length}</span>
        <span>Score: {gameState.score}</span>
        <span>Par: {currentLevel.parTime}s</span>
        <span>{gameState.isPaused ? 'PAUSED' : gameState.isGameOver ? 'GAME OVER' : gameState.isRunning ? 'RUNNING' : 'READY'}</span>
      </Paper>

      <Box
        ref={containerRef}
        role="application"
        aria-label="Vim Snake game area: use h/j/k/l to move the snake"
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
          <Button variant="contained" onClick={start}>
            Start Level
          </Button>
        )}
        {(gameState.isRunning || gameState.isGameOver) && (
          <Button variant="outlined" onClick={reset}>
            Reset
          </Button>
        )}
      </Stack>

      <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', fontFamily: 'monospace' }}>
        h/j/k/l to move &middot; Digits for count prefix &middot; ESC: pause
      </Typography>
    </Stack>
  )
}