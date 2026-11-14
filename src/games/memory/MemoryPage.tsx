import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'
import { MEMORY_LEVELS } from './levels'
import { useMemoryGame } from './useMemoryGame'
import { useArcadeStore } from '../../store/arcadeStore'
import { navigate } from '../../hooks/useRoute'

export function MemoryPage() {
  const [levelIndex, setLevelIndex] = useState(0)
  const saveScore = useArcadeStore((s) => s.saveScore)
  const level = MEMORY_LEVELS[levelIndex]
  const game = useMemoryGame(level)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'h':
        case 'j':
        case 'k':
        case 'l':
        case 'w':
        case 'b':
        case 'e':
          e.preventDefault()
          game.moveCursor(e.key)
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          game.flipCard(game.cursorIndex)
          break
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            game.reset()
          }
          break
      }
    },
    [game],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Save score on completion
  useEffect(() => {
    if (game.isComplete) {
      saveScore('memory', levelIndex + 1, game.score)
    }
  }, [game.isComplete, game.score, levelIndex, saveScore])

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleLevelChange = (newIndex: number) => {
    setLevelIndex(newIndex)
  }

  const handleBack = () => {
    navigate('arcade')
  }

  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      {/* Header */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
            Memory Match
          </Typography>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={levelIndex}
              onChange={(e) => handleLevelChange(Number(e.target.value))}
              sx={{ fontFamily: 'monospace' }}
            >
              {MEMORY_LEVELS.map((lvl, i) => (
                <MenuItem key={lvl.id} value={i}>
                  {lvl.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Button variant="outlined" size="small" onClick={handleBack}>
          Back to Arcade
        </Button>
      </Stack>

      {/* HUD */}
      <Paper
        elevation={1}
        sx={{
          px: 3,
          py: 1.5,
          display: 'flex',
          gap: 4,
          bgcolor: 'background.paper',
          borderColor: 'divider',
          borderWidth: 1,
          borderStyle: 'solid',
        }}
      >
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
          Moves: {game.moves}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
          Time: {formatTime(game.elapsedMs)}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
          Pairs left: {game.unmatchedCount}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
          Score: {game.score}
        </Typography>
      </Paper>

      {/* Completion banner */}
      {game.isComplete && (
        <Paper
          elevation={3}
          aria-live="assertive"
          sx={{
            p: 2,
            textAlign: 'center',
            bgcolor: 'success.dark',
            color: 'success.contrastText',
          }}
        >
          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
            Level Complete! Score: {game.score}
          </Typography>
          <Stack direction="row" sx={{ justifyContent: 'center', gap: 2, mt: 1 }}>
            <Button variant="contained" size="small" onClick={game.reset} sx={{ bgcolor: 'warning.main', color: 'warning.contrastText' }}>
              Retry
            </Button>
            {levelIndex < MEMORY_LEVELS.length - 1 && (
              <Button
                variant="contained"
                size="small"
                onClick={() => handleLevelChange(levelIndex + 1)}
                sx={{ bgcolor: 'warning.main', color: 'warning.contrastText' }}
              >
                Next Level
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* Card Grid */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${game.cols}, 1fr)`,
          gridTemplateRows: `repeat(${game.rows}, 1fr)`,
          gap: 1,
          maxWidth: 800,
          mx: 'auto',
          width: '100%',
        }}
      >
        {game.cards.map((card, index) => {
          const isFlipped = game.flippedIndices.includes(index)
          const isMatched = game.matchedIds.has(card.pairId)
          const isCursor = index === game.cursorIndex
          const showFace = isFlipped || isMatched

          let bgColor: string
          let borderColor: string
          let borderWidth = 1

          if (isMatched) {
            bgColor = '#2e4a2e'
            borderColor = '#4caf50'
          } else if (isFlipped) {
            bgColor = '#4a3a1e'
            borderColor = '#ffb74d'
          } else {
            bgColor = '#2d2d2d'
            borderColor = '#555'
          }

          if (isCursor) {
            borderColor = '#ffb74d'
            borderWidth = 3
          }

          return (
            <Card
              key={card.instanceId}
              component="button"
              aria-label={
                showFace
                  ? `${card.isCommand ? 'Command' : 'Description'}: ${card.isCommand ? card.command : card.description}${isMatched ? ', matched' : ''}`
                  : `Card ${index + 1}, face down`
              }
              tabIndex={-1}
              onClick={() => game.flipCard(index)}
              sx={{
                bgcolor: bgColor,
                borderColor,
                borderWidth,
                borderStyle: 'solid',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: isCursor ? '2px solid #ffb74d' : 'none',
                outlineOffset: -2,
                '&:focus-visible': {
                  outline: '2px solid #ffb74d',
                  outlineOffset: -2,
                },
              }}
            >
              <CardActionArea
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1,
                }}
              >
                {showFace ? (
                  <Typography
                    variant={card.isCommand ? 'h6' : 'body2'}
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: card.isCommand ? 700 : 400,
                      color: isMatched ? '#81c784' : '#ffb74d',
                      textAlign: 'center',
                      wordBreak: 'break-word',
                    }}
                  >
                    {card.isCommand ? card.command : card.description}
                  </Typography>
                ) : (
                  <Typography
                    variant="h5"
                    sx={{
                      fontFamily: 'monospace',
                      color: '#666',
                      userSelect: 'none',
                    }}
                  >
                    ?
                  </Typography>
                )}
              </CardActionArea>
            </Card>
          )
        })}
      </Box>

      {/* Controls hint */}
      <Typography
        variant="caption"
        sx={{
          textAlign: 'center',
          color: 'text.secondary',
          fontFamily: 'monospace',
        }}
      >
        h/j/k/l to move cursor &middot; Space to flip &middot; w/b/e to jump &middot; r to restart &middot; Match command with description!
      </Typography>

      {/* Live region for screen readers */}
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {game.isComplete
          ? `Level complete. Score: ${game.score}. ${game.moves} moves in ${formatTime(game.elapsedMs)}.`
          : `${game.unmatchedCount} pairs remaining. ${game.moves} moves.`}
      </Box>
    </Stack>
  )
}