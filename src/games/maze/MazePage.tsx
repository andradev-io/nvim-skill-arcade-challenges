import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useState } from 'react'
import { MAZE_LEVELS } from './levels'
import { MazeGame } from './MazeGame'
import type { GameConfig } from '../engine/types'
import { useCanvasGame } from '../engine/useCanvasGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'

export function MazePage() {
  const [levelIndex, setLevelIndex] = useState(0)
  const saveScore = useArcadeStore((s) => s.saveScore)

  const createGame = useCallback((config: GameConfig) => new MazeGame(config), [])

  const { canvasRef, containerRef, gameRef, gameState, start, reset } = useCanvasGame({
    createGame,
    initialState: { score: 0, lives: 1, wave: 0, isRunning: false, isPaused: false, isGameOver: false },
    onSaveScore: (score) => saveScore('maze', levelIndex + 1, score),
    onNavigateBack: () => navigate('arcade'),
    onInit: (game) => game.loadLevel(MAZE_LEVELS[levelIndex]),
    onReset: (game) => game.loadLevel(MAZE_LEVELS[levelIndex]),
    onRestart: (game) => game.loadLevel(MAZE_LEVELS[levelIndex]),
  })

  const handleNextLevel = () => {
    if (levelIndex < MAZE_LEVELS.length - 1) {
      setLevelIndex((i) => i + 1)
    }
  }

  const handleBack = () => {
    gameRef.current?.stop()
    navigate('arcade')
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
          <Button variant="contained" onClick={start}>
            Start Level
          </Button>
        )}
        {(gameState.isRunning || gameState.isGameOver) && (
          <Button variant="outlined" onClick={reset}>
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