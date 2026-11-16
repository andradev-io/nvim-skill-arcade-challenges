import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useMemo, useState } from 'react'
import { REGEX_LEVELS } from './levels'
import { RegexGame } from './RegexGame'
import type { GameConfig } from '../engine/types'
import { useCanvasGame } from '../engine/useCanvasGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'
import { parseArcadeQueryParams } from '../../pages/ArcadePage'

export function RegexPage() {
  const [levelIndex, setLevelIndex] = useState(() => {
    const params = parseArcadeQueryParams(window.location.hash)
    return params.level ? Number(params.level) : 0
  })
  const saveScore = useArcadeStore((s) => s.saveScore)

  const createGame = useCallback((config: GameConfig) => new RegexGame(config), [])

  const { canvasRef, containerRef, gameRef, gameState, start, reset } = useCanvasGame({
    createGame,
    initialState: { score: 0, lives: 1, wave: 0, isRunning: false, isPaused: false, isGameOver: false },
    onSaveScore: (score) => {
      saveScore('regex', levelIndex + 1, score)
    },
    onNavigateBack: () => navigate('arcade'),
    onInit: (game) => game.loadLevel(REGEX_LEVELS[levelIndex]),
    onReset: (game) => game.loadLevel(REGEX_LEVELS[levelIndex]),
    onRestart: (game) => game.loadLevel(REGEX_LEVELS[levelIndex]),
  })

  const handleLevelChange = (newIndex: number) => {
    gameRef.current?.stop()
    setLevelIndex(newIndex)
  }

  const handleBack = () => {
    gameRef.current?.stop()
    navigate('arcade')
  }

  const currentLevel = REGEX_LEVELS[levelIndex]

  const levelSelector = useMemo(
    () => (
      <Select
        value={levelIndex}
        size="small"
        onChange={(e) => handleLevelChange(Number(e.target.value))}
        sx={{ fontFamily: 'monospace', minWidth: 200 }}
      >
        {REGEX_LEVELS.map((lvl, idx) => (
          <MenuItem key={lvl.id} value={idx}>
            {lvl.name}
          </MenuItem>
        ))}
      </Select>
    ),
    [levelIndex],
  )

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
            Vim Regex Builder
          </Typography>
          {levelSelector}
        </Stack>
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
        <span>Level: {levelIndex + 1}/{REGEX_LEVELS.length}</span>
        <span>Score: {gameState.score}</span>
        <span>Par: {currentLevel.parSeconds}s</span>
        <span>
          {gameState.isPaused
            ? 'PAUSED'
            : gameState.isGameOver
              ? 'COMPLETE'
              : gameState.isRunning
                ? 'RUNNING'
                : 'READY'}
        </span>
      </Paper>

      <Box
        ref={containerRef}
        role="application"
        aria-label="Vim Regex Builder game area: type /pattern to match highlighted targets"
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
        Type /pattern to match highlighted targets &middot; Enter: submit &middot; j/k: hints &middot; h/l: move cursor &middot; ESC: pause/clear &middot; r: reset puzzle
      </Typography>
    </Stack>
  )
}