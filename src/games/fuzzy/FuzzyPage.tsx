import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useState } from 'react'
import { FUZZY_LEVELS } from './levels'
import { FuzzyGame } from './FuzzyGame'
import type { GameConfig } from '../engine/types'
import { useCanvasGame } from '../engine/useCanvasGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'
import { parseArcadeQueryParams } from '../../pages/ArcadePage'

export function FuzzyPage() {
  const [levelIndex, setLevelIndex] = useState(() => {
    const params = parseArcadeQueryParams(window.location.hash)
    return params.level ? Number(params.level) : 0
  })
  const saveScore = useArcadeStore((s) => s.saveScore)

  const createGame = useCallback((config: GameConfig) => new FuzzyGame(config), [])

  const { canvasRef, containerRef, gameRef, gameState, start, reset } = useCanvasGame({
    createGame,
    initialState: { score: 0, lives: 1, wave: 0, isRunning: false, isPaused: false, isGameOver: false },
    onSaveScore: (score) => {
      saveScore('fuzzy', levelIndex + 1, score)
    },
    onNavigateBack: () => navigate('arcade'),
    onInit: (game) => game.loadLevel(FUZZY_LEVELS[levelIndex]),
    onReset: (game) => game.loadLevel(FUZZY_LEVELS[levelIndex]),
    onRestart: (game) => game.loadLevel(FUZZY_LEVELS[levelIndex]),
  })

  const handleNextLevel = () => {
    if (levelIndex < FUZZY_LEVELS.length - 1) {
      setLevelIndex((i) => i + 1)
    }
  }

  const handleBack = () => {
    gameRef.current?.stop()
    navigate('arcade')
  }

  const currentLevel = FUZZY_LEVELS[levelIndex]

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
          Vim Fuzzy Finder: {currentLevel.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Select
            size="small"
            value={levelIndex}
            onChange={(e) => setLevelIndex(Number(e.target.value))}
            sx={{ fontFamily: 'monospace', fontSize: 14, minWidth: 160 }}
          >
            {FUZZY_LEVELS.map((lvl, i) => (
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
        <span>Level: {levelIndex + 1}/{FUZZY_LEVELS.length}</span>
        <span>Score: {gameState.score}</span>
        <span>Par: {currentLevel.parSeconds}s</span>
        <span>{gameState.isPaused ? 'PAUSED' : gameState.isGameOver ? 'COMPLETE' : gameState.isRunning ? 'RUNNING' : 'READY'}</span>
      </Paper>

      <Box
        ref={containerRef}
        role="application"
        aria-label="Vim Fuzzy Finder game area: type to filter, j/k to navigate, Enter to select"
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
        {gameState.isGameOver && levelIndex < FUZZY_LEVELS.length - 1 && (
          <Button variant="contained" onClick={handleNextLevel}>
            Next Level
          </Button>
        )}
      </Stack>

      <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', fontFamily: 'monospace' }}>
        Type to filter &middot; j/k to navigate &middot; Enter to select &middot; Esc to clear/pause &middot; r to reset round
      </Typography>
    </Stack>
  )
}