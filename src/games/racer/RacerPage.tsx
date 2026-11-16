import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useState } from 'react'
import { RACER_LEVELS } from './levels'
import { RacerGame } from './RacerGame'
import type { GameConfig } from '../engine/types'
import { useCanvasGame } from '../engine/useCanvasGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'

export function RacerPage() {
  const [levelIndex, setLevelIndex] = useState(0)
  const saveScore = useArcadeStore((s) => s.saveScore)

  const createGame = useCallback((config: GameConfig) => new RacerGame(config), [])

  const { canvasRef, containerRef, gameRef, gameState, start, reset } = useCanvasGame({
    createGame,
    initialState: { score: 0, lives: 3, wave: 0, isRunning: false, isPaused: false, isGameOver: false },
    onSaveScore: (score) => saveScore('racer', levelIndex + 1, score),
    onNavigateBack: () => navigate('arcade'),
    onInit: (game) => game.loadLevel(RACER_LEVELS[levelIndex]),
    onReset: (game) => game.loadLevel(RACER_LEVELS[levelIndex]),
    onRestart: (game) => game.loadLevel(RACER_LEVELS[levelIndex]),
  })

  const handleLevelChange = (newIndex: number) => {
    gameRef.current?.stop()
    setLevelIndex(newIndex)
  }

  const handleBack = () => {
    gameRef.current?.stop()
    navigate('arcade')
  }

  const currentLevel = RACER_LEVELS[levelIndex]

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
          Vim Racer: {currentLevel.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Select
            value={levelIndex}
            size="small"
            onChange={(e) => handleLevelChange(Number(e.target.value))}
            sx={{ fontFamily: 'monospace', fontSize: 14 }}
          >
            {RACER_LEVELS.map((lvl, i) => (
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
        <span>Level: {levelIndex + 1}/{RACER_LEVELS.length}</span>
        <span>Score: {gameState.score}</span>
        <span>Lives: {gameState.lives}</span>
        <span>{gameState.isPaused ? 'PAUSED' : gameState.isGameOver ? 'GAME OVER' : gameState.isRunning ? 'RACING' : 'READY'}</span>
      </Paper>

      <Box
        ref={containerRef}
        role="application"
        aria-label="Vim Racer game area: type vim commands to clear obstacles"
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
            Start Race
          </Button>
        )}
        {(gameState.isRunning || gameState.isGameOver) && (
          <Button variant="outlined" onClick={reset}>
            Reset
          </Button>
        )}
      </Stack>

      <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', fontFamily: 'monospace' }}>
        Type shown commands to clear obstacles &middot; j/k to switch lanes &middot; ESC: pause
      </Typography>
    </Stack>
  )
}