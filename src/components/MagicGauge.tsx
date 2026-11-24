import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card } from '#/components/ui/Card.tsx'
import { statusStyles } from '#/components/ui/StatusBadge.tsx'
import { GLITCH_STATUSES, magicLevel, type Glitch } from '#/lib/glitch.ts'

/** Green (100) → orange (50) → red (0), as an HSL hue. */
export function magicColor(value: number): string {
  const hue = value >= 50 ? 30 + ((value - 50) / 50) * 115 : (value / 50) * 30
  return `hsl(${Math.round(hue)} 80% 47%)`
}

export const GAUGE_ID = 'magic-gauge'
/** When magic goes up, wait for the repair particles to "deliver" it. */
const INCREASE_DELAY_MS = 850
const ANIMATION_MS = 1200

const CX = 100
const CY = 100
const R = 80
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`

/** Point on the arc at fraction `f` (0 = left end, 1 = right end). */
function pointAt(f: number, radius = R) {
  const angle = Math.PI * (1 - f)
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) }
}

function verdict(value: number): string {
  if (value === 100) return 'Achrona is stable'
  if (value >= 70) return 'Minor disturbances'
  if (value >= 40) return 'Magic is draining'
  return 'Critical — Desync attack'
}

// Survives page changes, so coming back to the overview animates from the last value seen.
let lastShown: number | null = null

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Smoothly animates towards `target` (ease-out), never jumping. */
function useAnimatedValue(target: number): number {
  const [display, setDisplay] = useState(target)
  const current = useRef<number | null>(null)

  useEffect(() => {
    const from = current.current ?? lastShown ?? target
    current.current = from
    if (from === target || prefersReducedMotion()) {
      current.current = target
      lastShown = target
      setDisplay(target)
      return
    }
    setDisplay(from)
    let frame = 0
    let start = 0
    const delay = target > from ? INCREASE_DELAY_MS : 0
    const timer = setTimeout(() => {
      const step = (now: number) => {
        start ||= now
        const t = Math.min(1, (now - start) / ANIMATION_MS)
        const eased = 1 - (1 - t) ** 3
        const value = from + (target - from) * eased
        current.current = value
        lastShown = value
        setDisplay(value)
        if (t < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [target])

  return display
}

/** Half-circle "Magic in Achrona" meter plus a count per status. */
export function MagicGauge({ glitches }: { glitches: Pick<Glitch, 'status'>[] }) {
  const value = magicLevel(glitches)
  const shown = useAnimatedValue(value)
  const color = magicColor(shown)
  const threshold = [pointAt(0.4, R - 14), pointAt(0.4, R + 14)]
  const needleDeg = (shown / 100) * 180

  return (
    <Card className="grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center md:p-6">
      <figure className="mx-auto flex w-full max-w-[260px] flex-col items-center">
        <svg
          id={GAUGE_ID}
          viewBox="0 0 200 116"
          className="w-full overflow-visible"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-label="Magic in Achrona"
        >
          <path d={ARC} fill="none" stroke="var(--line)" strokeWidth={16} strokeLinecap="round" />
          {shown >= 0.5 && (
            <path
              d={ARC}
              fill="none"
              stroke={color}
              strokeWidth={16}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${shown} 200`}
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
          )}
          {/* Lockdown threshold at 40% */}
          <line x1={threshold[0].x} y1={threshold[0].y} x2={threshold[1].x} y2={threshold[1].y} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="2 2" />
          {/* Needle drawn pointing at 0 and rotated around the hub. */}
          <line
            x1={CX} y1={CY} x2={CX - (R - 26)} y2={CY}
            stroke="var(--fg)" strokeWidth={3} strokeLinecap="round"
            style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: `${CX}px ${CY}px` }}
          />
          <circle cx={CX} cy={CY} r={6} fill="var(--fg)" />
          <text x={CX - R} y={CY + 16} textAnchor="middle" className="fill-muted text-[9px]">0</text>
          <text x={CX + R} y={CY + 16} textAnchor="middle" className="fill-muted text-[9px]">100</text>
        </svg>
        <figcaption className="-mt-1 flex flex-col items-center text-center">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>
            {Math.round(shown)}%
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-[0.2em] text-muted uppercase">
            <Sparkles className="size-3.5" /> Magic in Achrona
          </span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-lg font-semibold text-fg">{verdict(value)}</p>
          <p className="text-sm text-muted">
            Every leaked glitch drains 15%, assessing 10%, containing 5%. Fix them all to restore 100%.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {GLITCH_STATUSES.map((status) => {
            const n = glitches.filter((g) => g.status === status).length
            return (
              <div key={status} className="rounded-2xl border border-line bg-panel px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                  <span className={`size-2 rounded-full ${statusStyles[status].dot}`} />
                  {status}
                </dt>
                <dd className="text-2xl font-semibold text-fg tabular-nums">{n}</dd>
              </div>
            )
          })}
        </dl>
      </div>
    </Card>
  )
}
