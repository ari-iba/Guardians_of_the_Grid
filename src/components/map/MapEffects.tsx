import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { STATUS_HEX } from '#/components/ui/StatusBadge.tsx'
import type { District } from '#/lib/district.ts'
import type { GlitchStatus, GlitchSummary } from '#/lib/glitch.ts'
import { MAP, polygonPath } from '#/lib/map-geometry.ts'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

type Placed = { glitch: GlitchSummary; x: number; y: number }
type Burst = { id: string; x: number; y: number }
type Exit = Placed & { status: GlitchStatus }

/**
 * Watches the placed markers and reports what changed:
 * - new markers (live) → ripple + callback (camera nudge)
 * - markers that became FIXED (live) → star burst + district turns green
 * - markers that just disappeared otherwise (e.g. replay) → kept briefly to fade out
 */
export function useMarkerChanges(placed: Placed[], all: GlitchSummary[], live: boolean, onNew: (district: District) => void) {
  const previous = useRef<Map<string, Placed> | null>(null)
  const [ripples, setRipples] = useState<(Burst & { district: District })[]>([])
  const [bursts, setBursts] = useState<(Burst & { color: string })[]>([])
  const [healed, setHealed] = useState<District[]>([])
  const [exits, setExits] = useState<Exit[]>([])
  const onNewRef = useRef(onNew)
  onNewRef.current = onNew

  useEffect(() => {
    const now = new Map(placed.map((p) => [p.glitch.glitchId, p]))
    const before = previous.current
    previous.current = now
    if (!before) return
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))

    const added = placed.filter((p) => !before.has(p.glitch.glitchId))
    const removed = [...before.values()].filter((p) => !now.has(p.glitch.glitchId))

    if (live && added.length) {
      const items = added.map((p) => {
        const [x, y] = MAP.districts[p.glitch.district].capital
        return { id: `${p.glitch.glitchId}-${Date.now()}`, x, y, district: p.glitch.district }
      })
      setRipples((r) => [...r, ...items])
      later(() => setRipples((r) => r.filter((i) => !items.includes(i))), 1900)
      onNewRef.current(added[added.length - 1].glitch.district)
    }

    const fixed = live ? removed.filter((p) => all.some((g) => g.glitchId === p.glitch.glitchId && g.status === 'FIXED')) : []
    if (fixed.length) {
      const items = fixed.map((p) => ({ id: `${p.glitch.glitchId}-${Date.now()}`, x: p.x, y: p.y, color: STATUS_HEX[p.glitch.status] }))
      const districts = fixed.map((p) => p.glitch.district)
      setBursts((b) => [...b, ...items])
      setHealed((h) => [...h, ...districts])
      later(() => setBursts((b) => b.filter((i) => !items.includes(i))), 1500)
      later(() => setHealed((h) => h.filter((d) => !districts.includes(d))), 2200)
    }

    const fading = removed.filter((p) => !fixed.includes(p)).map((p) => ({ ...p, status: p.glitch.status }))
    if (fading.length) {
      setExits((e) => [...e, ...fading])
      later(() => setExits((e) => e.filter((i) => !fading.includes(i))), 380)
    }
    return () => timers.forEach((t) => clearTimeout(t))
  }, [placed]) // `all` and `live` change together with `placed`

  return { ripples, bursts, healed, exits }
}

/** Drifting clouds / mist over the world (CSS only, moves with the map). */
export const Clouds = memo(function Clouds() {
  const clouds = [
    { top: 6, w: 520, h: 170, dur: 140, delay: -20 },
    { top: 30, w: 380, h: 130, dur: 110, delay: -70 },
    { top: 52, w: 600, h: 190, dur: 170, delay: -120 },
    { top: 74, w: 420, h: 140, dur: 125, delay: -40 },
    { top: 18, w: 300, h: 100, dur: 95, delay: -60 },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {clouds.map((c, i) => (
        <span
          key={i}
          className="map-cloud"
          style={{ top: `${c.top}%`, width: c.w, height: c.h, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
        />
      ))}
    </div>
  )
})

/** Red storm with drifting mist and the odd lightning strike, over the given districts only. */
export function Storm({ districts }: { districts: District[] }) {
  return (
    <g clipPath="url(#m-land-clip)" pointerEvents="none">
      <defs>
        <radialGradient id="storm-mist">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        {districts.map((d) => (
          <clipPath key={d} id={`storm-clip-${d}`}>
            <path d={polygonPath(MAP.districts[d].polygon)} />
          </clipPath>
        ))}
      </defs>
      {districts.map((d, i) => {
        const [cx, cy] = MAP.districts[d].capital
        const bolt = `M${cx - 30},${cy - 150}l22,58l-18,4l30,70l-12,3l34,62l-46,-70l16,-4l-30,-62l18,-3z`
        return (
          <g key={d} clipPath={`url(#storm-clip-${d})`}>
            <path d={polygonPath(MAP.districts[d].polygon)} className="storm-tint" />
            <g className="storm-drift" style={{ animationDelay: `${-i * 2.3}s` } as CSSProperties}>
              <ellipse cx={cx - 90} cy={cy - 30} rx="210" ry="120" fill="url(#storm-mist)" />
              <ellipse cx={cx + 110} cy={cy + 60} rx="240" ry="130" fill="url(#storm-mist)" />
              <ellipse cx={cx} cy={cy + 150} rx="180" ry="100" fill="url(#storm-mist)" />
            </g>
            <path d={polygonPath(MAP.districts[d].polygon)} className="storm-flash" style={{ animationDelay: `${i * 2.9 + 1}s` }} />
            <path d={bolt} className="storm-bolt" style={{ animationDelay: `${i * 2.9 + 1}s` }} />
          </g>
        )
      })}
    </g>
  )
}

/** One-off effects: ripples for new glitches, star bursts for repaired ones, green heal flashes. */
export function Effects({
  ripples,
  bursts,
  healed,
  k,
}: {
  ripples: { id: string; x: number; y: number }[]
  bursts: { id: string; x: number; y: number; color: string }[]
  healed: District[]
  k: number
}) {
  return (
    <g pointerEvents="none">
      <g clipPath="url(#m-land-clip)">
        {healed.map((d, i) => (
          <path key={`${d}-${i}`} d={polygonPath(MAP.districts[d].polygon)} className="district-heal" />
        ))}
      </g>
      {ripples.map((r) => (
        <g key={r.id} transform={`translate(${r.x} ${r.y})`}>
          <circle r="220" className="map-ripple" />
          <circle r="220" className="map-ripple map-ripple-late" />
        </g>
      ))}
      {bursts.map((b) => (
        <g key={b.id} transform={`translate(${b.x} ${b.y}) scale(${1 / k})`}>
          <circle r="8" fill={b.color} className="marker-dissolve" />
          {Array.from({ length: 10 }, (_, i) => {
            const angle = (i / 10) * Math.PI * 2
            const dist = 22 + (i % 3) * 9
            return (
              <text
                key={i}
                textAnchor="middle"
                y="4"
                className="map-star"
                style={{ '--dx': `${Math.cos(angle) * dist}px`, '--dy': `${Math.sin(angle) * dist}px`, animationDelay: `${(i % 4) * 40}ms` } as CSSProperties}
                fill={i % 2 ? '#fbbf24' : '#34d399'}
              >
                ✦
              </text>
            )
          })}
        </g>
      ))}
    </g>
  )
}
