import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MemoryLevel } from './types'
import { buildShuffledGrid } from './cards'

interface CardInstance {
  pairId: string
  instanceId: string
  command: string
  description: string
  isCommand: boolean
}

export interface MemoryGameActions {
  cards: CardInstance[]
  flippedIndices: number[]
  matchedIds: Set<string>
  moves: number
  elapsedMs: number
  isComplete: boolean
  score: number
  cursorIndex: number
  cols: number
  rows: number
  flipCard: (index: number) => void
  moveCursor: (key: string) => void
  reset: () => void
  unmatchedCount: number
}

function calcScore(pairCount: number, moves: number, elapsedMs: number): number {
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const raw = pairCount * 100 - moves * 5 - elapsedSeconds * 2
  return Math.max(0, raw)
}

/** Build initial card grid from level pairs. */
function buildInitialCards(level: MemoryLevel): CardInstance[] {
  return buildShuffledGrid(level.pairs).map((c) => ({
    pairId: c.id,
    instanceId: c.instanceId,
    command: c.command,
    description: c.description,
    isCommand: c.instanceId.endsWith('-cmd'),
  }))
}

export function useMemoryGame(level: MemoryLevel): MemoryGameActions {
  const [cards, setCards] = useState<CardInstance[]>(() => buildInitialCards(level))
  const [flippedIndices, setFlippedIndices] = useState<number[]>([])
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [cursorIndex, setCursorIndex] = useState(0)
  const lockRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)
  const prevLevelRef = useRef(level)

  const totalPairs = level.pairs.length
  const cols = level.gridCols
  const rows = level.gridRows

  // Reset game state when level changes (not on initial mount)
  useEffect(() => {
    if (prevLevelRef.current === level) return
    prevLevelRef.current = level
    setCards(buildInitialCards(level))
    setFlippedIndices([])
    setMatchedIds(new Set())
    setMoves(0)
    setElapsedMs(0)
    setIsComplete(false)
    setCursorIndex(0)
    lockRef.current = false
    startedRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [level])

  // Timer
  useEffect(() => {
    if (startedRef.current && !isComplete && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setElapsedMs((ms) => ms + 100)
      }, 100)
    }
    if (isComplete && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isComplete])

  const flipCard = useCallback(
    (index: number) => {
      if (lockRef.current || isComplete) return
      if (index < 0 || index >= cards.length) return
      if (matchedIds.has(cards[index].pairId)) return
      if (flippedIndices.includes(index)) return

      if (!startedRef.current) {
        startedRef.current = true
      }

      const newFlipped = [...flippedIndices, index]
      setFlippedIndices(newFlipped)

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1)
        lockRef.current = true
        const [first, second] = newFlipped
        const firstCard = cards[first]
        const secondCard = cards[second]

        if (firstCard.pairId === secondCard.pairId) {
          // Match
          setMatchedIds((prev) => {
            const next = new Set(prev)
            next.add(firstCard.pairId)
            return next
          })
          setFlippedIndices([])
          lockRef.current = false

          // Check completion
          setMatchedIds((prev) => {
            if (prev.size === totalPairs) {
              setIsComplete(true)
            }
            return prev
          })
        } else {
          // No match — flip back after delay
          setTimeout(() => {
            setFlippedIndices([])
            lockRef.current = false
          }, 800)
        }
      }
    },
    [cards, flippedIndices, matchedIds, isComplete, totalPairs],
  )

  // Derive completion from matched count — no setState inside effect needed
  const derivedComplete = useMemo(
    () => matchedIds.size === totalPairs && totalPairs > 0,
    [matchedIds, totalPairs],
  )

  const moveCursor = useCallback(
    (key: string) => {
      if (derivedComplete) return
      const row = Math.floor(cursorIndex / cols)
      const col = cursorIndex % cols

      let newRow = row
      let newCol = col

      switch (key) {
        case 'h':
          newCol = col > 0 ? col - 1 : cols - 1
          break
        case 'l':
          newCol = col < cols - 1 ? col + 1 : 0
          break
        case 'k':
          newRow = row > 0 ? row - 1 : rows - 1
          break
        case 'j':
          newRow = row < rows - 1 ? row + 1 : 0
          break
        case 'w': {
          // Jump forward by one "word" (3 cells), wrapping
          let next = cursorIndex + 3
          if (next >= cards.length) next = next % cards.length
          setCursorIndex(next)
          return
        }
        case 'b': {
          // Jump backward by one "word" (3 cells), wrapping
          let next = cursorIndex - 3
          while (next < 0) next += cards.length
          setCursorIndex(next)
          return
        }
        case 'e': {
          // Jump to end of "word" (2 cells forward)
          let next = cursorIndex + 2
          if (next >= cards.length) next = cards.length - 1
          setCursorIndex(next)
          return
        }
        default:
          return
      }

      const newIndex = newRow * cols + newCol
      if (newIndex >= 0 && newIndex < cards.length) {
        setCursorIndex(newIndex)
      }
    },
    [cursorIndex, cols, rows, cards.length, derivedComplete],
  )

  const score = calcScore(totalPairs, moves, elapsedMs)
  const unmatchedCount = totalPairs - matchedIds.size

  return {
    cards,
    flippedIndices,
    matchedIds,
    moves,
    elapsedMs,
    isComplete: derivedComplete,
    score,
    cursorIndex,
    cols,
    rows,
    flipCard,
    moveCursor,
    reset: useCallback(() => {
 setCards(buildInitialCards(level))
 setFlippedIndices([])
 setMatchedIds(new Set())
 setMoves(0)
 setElapsedMs(0)
 setIsComplete(false)
 setCursorIndex(0)
 lockRef.current = false
 startedRef.current = false
 if (timerRef.current) {
 clearInterval(timerRef.current)
 timerRef.current = null
 }
 }, [level]),
    unmatchedCount,
  }
}