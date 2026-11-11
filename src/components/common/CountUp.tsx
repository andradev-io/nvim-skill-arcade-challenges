import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Counts from 0 up to `value` once the element scrolls into view. Shows the final number at once with reduced motion. */
export function CountUp({ value, suffix = '', ms = 1100 }: { value: number | null; suffix?: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(0)
  const [seen, setSeen] = useState(false)
  const instant = reduced()

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { threshold: 0.3 })
    io.observe(el)
    // some embedded views never deliver intersection events: a tile already on screen must not stay at 0
    const fallback = window.setTimeout(() => el.getBoundingClientRect().top < window.innerHeight && setSeen(true), 1500)
    return () => {
      io.disconnect()
      window.clearTimeout(fallback)
    }
  }, [])

  useEffect(() => {
    if (value === null || !seen || instant) return
    let timer = 0
    const start = performance.now()
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ms)
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) timer = window.setTimeout(tick, 16)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [value, seen, instant, ms])

  // Default text color while it counts, then the surrounding (accent) color once it lands on the final number.
  const done = value !== null && (instant || shown === value)
  return (
    <span
      ref={ref}
      aria-label={value === null ? undefined : `${value}${suffix}`}
      style={{ color: done ? undefined : 'var(--mui-palette-text-primary)', transition: 'color 0.5s ease' }}
    >
      {value === null ? '-' : `${instant ? value : shown}${suffix}`}
    </span>
  )
}
