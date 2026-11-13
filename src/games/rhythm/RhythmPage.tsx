import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useState } from 'react'
import { RHYTHM_LEVELS } from './levels'
import { RhythmGame } from './RhythmGame'
import type { GameConfig } from '../engine/types'
import { useCanvasGame } from '../engine/useCanvasGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'

export function RhythmPage() {
  const [levelIndex, setLevelIndex] = useState(0)
  const saveScore = useArcadeStore((s) => s.saveScore)

  const createGame = useCallback((config: GameConfig) => new RhythmGame(config), [])

  const { canvasRef, containerRef, gameRef, gameState, start, reset } = useCanvasGame({
    createGame,
    initialState: { score: 0, lives: 1, wave: 0, isRunning: false, isPaused: false, isGameOver: false },
    onSaveScore: (score) => saveScore('rhythm', levelIndex + 1, score),
    onNavigateBack: () => navigate('arcade'),
    onInit: (game) => game.loadLevel(RHYTHM_LEVELS[levelIndex]),
    onReset: (game) => game.loadLevel(RHYTHM_LEVELS[levelIndex]),
    onRestart: (game) => game.loadLevel(RHYTHM_LEVELS[levelIndex]),
  })

  const handleBack = () => {
    gameRef.current?.stop()
    navigate('arcade')
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
        aria-live="polite"
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
        role="application"
        aria-label="Vim Rhythm game area: press h/j/k/l when notes reach the hit line"
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
            Start Song
          </Button>
        )}
        {(gameState.isRunning || gameState.isGameOver) && (
          <Button variant="outlined" onClick={reset}>
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