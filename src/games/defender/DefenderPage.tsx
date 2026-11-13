import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback } from 'react'
import { DefenderGame } from './DefenderGame'
import type { GameConfig } from '../engine/types'
import { useCanvasGame } from '../engine/useCanvasGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'

export function DefenderPage() {
 const saveScore = useArcadeStore((s) => s.saveScore)

 const createGame = useCallback((config: GameConfig) => new DefenderGame(config), [])

 const { canvasRef, containerRef, gameRef, gameState, start, reset } = useCanvasGame({
 createGame,
 initialState: { score: 0, lives: 3, wave: 1, isRunning: false, isPaused: false, isGameOver: false },
 onSaveScore: (score) => {
 const wave = gameRef.current?.getState().wave ?? 1
 saveScore('defender', wave, score)
 },
 onNavigateBack: () => navigate('arcade'),
 onRestart: (game) => game.stop(),
 })

 const handleBack = () => {
 gameRef.current?.stop()
 navigate('arcade')
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
 <span>Wave: {gameState.wave}</span>
 <span>Score: {gameState.score}</span>
 <span>Lives: {gameState.lives}</span>
 <span>{gameState.isPaused ? 'PAUSED' : gameState.isGameOver ? 'GAME OVER' : gameState.isRunning ? 'PLAYING' : 'READY'}</span>
 </Paper>

 <Box
 ref={containerRef}
 role="application"
 aria-label="Vim Defender game area: type vim commands to destroy enemies"
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
 Start Game
 </Button>
 )}
 {(gameState.isRunning || gameState.isGameOver) && (
 <Button variant="outlined" onClick={reset}>
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