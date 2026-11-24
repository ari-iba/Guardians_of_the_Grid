import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { Users, X } from 'lucide-react'
import { DefenderFigure } from '#/components/game/DefenderFigure.tsx'
import { StatusBadge } from '#/components/ui/StatusBadge.tsx'
import { DISTRICT_LABELS, isDistrict, type District } from '#/lib/district.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'

export type DropTarget = { kind: 'marker'; glitchId: string } | { kind: 'district'; district: District }

const DRAG_SLOP = 4 // px before a press on a figure becomes a drag

/** What lies under a screen point: a glitch marker wins over the district around it. */
export function dropTargetAt(clientX: number, clientY: number): DropTarget | null {
  const el = document.elementFromPoint(clientX, clientY)
  const marker = el?.closest<SVGElement>('[data-glitch-marker]')
  if (marker?.dataset.glitchMarker) return { kind: 'marker', glitchId: marker.dataset.glitchMarker }
  const district = el?.closest<SVGElement>('[data-district]')?.dataset.district
  return isDistrict(district) ? { kind: 'district', district } : null
}

export const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  !!a && !!b && (a.kind === 'marker' ? b.kind === 'marker' && a.glitchId === b.glitchId : b.kind === 'district' && a.district === b.district)

type Drag = {
  guardianId: string
  /** Viewport-local position of the floating figure. */
  x: number
  y: number
  origin: { x: number; y: number }
  target: DropTarget | null
  phase: 'drag' | 'return'
}

/**
 * Pointer-event dragging (mouse and touch) of squad figures over the map.
 * The press is stopped at the figure, so the map underneath never starts panning.
 */
export function useSquadDrag(viewportRef: RefObject<HTMLDivElement | null>, onDrop: (guardianId: string, target: DropTarget, at: { x: number; y: number }) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Set after a real drag so the click that may follow doesn't toggle "picked". */
  const justDragged = useRef(false)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  const start = (e: ReactPointerEvent<HTMLElement>, guardianId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.stopPropagation() // the map must not pan
    const viewport = viewportRef.current
    if (!viewport) return
    const box = viewport.getBoundingClientRect()
    const fig = e.currentTarget.getBoundingClientRect()
    const origin = { x: fig.left + fig.width / 2 - box.left, y: fig.top + fig.height / 2 - box.top }
    const startX = e.clientX
    const startY = e.clientY
    let moving = false
    justDragged.current = false

    const move = (ev: PointerEvent) => {
      if (!moving && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_SLOP) return
      moving = true
      ev.preventDefault()
      setDrag({ guardianId, x: ev.clientX - box.left, y: ev.clientY - box.top, origin, target: dropTargetAt(ev.clientX, ev.clientY), phase: 'drag' })
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (!moving) return
      justDragged.current = true
      const target = ev.type === 'pointerup' ? dropTargetAt(ev.clientX, ev.clientY) : null
      if (target) {
        setDrag(null)
        onDropRef.current(guardianId, target, { x: ev.clientX - box.left, y: ev.clientY - box.top })
      } else {
        // Empty spot: the figure jumps back to the squad bar.
        setDrag((d) => (d ? { ...d, x: d.origin.x, y: d.origin.y, target: null, phase: 'return' } : null))
        window.setTimeout(() => setDrag((d) => (d?.phase === 'return' ? null : d)), 320)
      }
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return { drag, start, justDragged }
}

/** Commander's squad: one figure per defender, with how many open glitches they already carry. */
export function SquadBar({
  defenders,
  glitches,
  picked,
  draggingId,
  onPick,
  onStartDrag,
  justDragged,
}: {
  defenders: Guardian[]
  glitches: GlitchSummary[]
  picked: string | null
  draggingId: string | null
  onPick: (guardianId: string | null) => void
  onStartDrag: (e: ReactPointerEvent<HTMLElement>, guardianId: string) => void
  justDragged: { current: boolean }
}) {
  return (
    <section
      aria-label="Squad: drag a defender onto a glitch to assign them"
      className="squad-bar glass pointer-events-auto flex items-end gap-1 rounded-2xl px-2 pt-1.5 pb-1"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="mr-1 hidden flex-col self-center sm:flex" title="Squad = your defenders. Drop one on a glitch to assign it.">
        <span className="inline-flex items-center gap-1 font-pixel text-[9px] text-neon-cyan">
          <Users className="size-3.5" /> SQUAD
        </span>
        <span className="max-w-32 text-[10px] leading-tight text-muted">{picked ? 'Now click a glitch · Esc cancels' : 'Drag onto a glitch'}</span>
      </span>
      <ul className="flex gap-1 overflow-x-auto">
        {defenders.map((d) => {
          const load = glitches.filter((g) => g.assignedGuardianId === d.guardianId && g.status !== 'FIXED').length
          const active = picked === d.guardianId
          const away = draggingId === d.guardianId
          return (
            <li key={d.guardianId}>
              <button
                type="button"
                data-squad={d.guardianId}
                aria-pressed={active}
                aria-label={`${d.codename}, ${load} open glitch${load === 1 ? '' : 'es'}. Drag onto a glitch, or press to pick and then choose a glitch.`}
                title={`${d.codename} — ${load} open glitch${load === 1 ? '' : 'es'} assigned`}
                onPointerDown={(e) => onStartDrag(e, d.guardianId)}
                onClick={() => {
                  if (justDragged.current) {
                    justDragged.current = false
                    return
                  }
                  onPick(active ? null : d.guardianId)
                }}
                className={`squad-unit relative flex w-16 touch-none flex-col items-center rounded-xl px-1 pt-1 pb-0.5 transition select-none ${
                  active ? 'bg-neon-cyan/15 ring-2 ring-neon-cyan' : 'hover:bg-subtle'
                } ${away ? 'opacity-30' : ''}`}
              >
                <DefenderFigure guardianId={d.guardianId} className={`h-11 w-9 ${away ? '' : 'figure-idle'}`} />
                <span className="max-w-full truncate text-[11px] font-semibold text-fg">{d.codename}</span>
                <span
                  className={`absolute top-0 right-1 min-w-4 rounded px-1 text-center font-pixel text-[8px] leading-4 ${load ? 'bg-neon-gold text-black' : 'bg-subtle text-muted'}`}
                >
                  {load}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The figure following the cursor / finger. */
export function DragGhost({ guardianId, x, y, phase, valid }: { guardianId: string; x: number; y: number; phase: 'drag' | 'return'; valid: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-[85%] ${phase === 'return' ? 'ghost-return' : ''}`}
      style={{ left: x, top: y }}
    >
      <DefenderFigure guardianId={guardianId} className={`h-16 w-13 drop-shadow-lg ${phase === 'drag' ? 'figure-carried' : ''}`} />
      {phase === 'drag' && (
        <span className={`absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 rounded-full ${valid ? 'bg-emerald-400 shadow-[0_0_10px_2px_rgb(52_211_153)]' : 'bg-white/50'}`} />
      )}
    </div>
  )
}

/** District with several open glitches: pick which one gets the defender. */
export function DropChooser({
  district,
  glitches,
  codename,
  x,
  y,
  onChoose,
  onClose,
}: {
  district: District
  glitches: GlitchSummary[]
  codename: string
  x: number
  y: number
  onChoose: (glitchId: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[data-choice]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Choose a glitch in ${DISTRICT_LABELS[district]} for ${codename}`}
      className="absolute z-40 w-72 max-w-[calc(100%-1.5rem)] rounded-2xl border border-line bg-card/95 p-2 shadow-2xl backdrop-blur"
      style={{ left: `clamp(0.75rem, ${x - 144}px, calc(100% - 18.75rem))`, top: `clamp(0.75rem, ${y - 20}px, calc(100% - 16rem))` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold text-muted">
          Deploy <strong className="text-fg">{codename}</strong> to… <span className="font-map">{DISTRICT_LABELS[district]}</span>
        </p>
        <button type="button" aria-label="Cancel" onClick={onClose} className="rounded p-0.5 text-muted hover:text-fg">
          <X className="size-4" />
        </button>
      </div>
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {glitches.map((g) => (
          <li key={g.glitchId}>
            <button
              type="button"
              data-choice={g.glitchId}
              onClick={() => onChoose(g.glitchId)}
              className="flex w-full flex-col gap-1 rounded-xl px-2 py-1.5 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-muted">
                  {g.glitchId}
                  {g.source === 'auto' && ' 🤖'}
                </span>
                <StatusBadge status={g.status} />
              </span>
              <span className="line-clamp-1 text-sm text-fg">{g.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The defender lands on the glitch: drop, bounce, a puff of dust and a few stars. */
export function LandingFx({ guardianId, x, y }: { guardianId: string; x: number; y: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute z-30" style={{ left: x, top: y }}>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="dust-puff" style={{ '--dx': `${Math.cos((i / 6) * Math.PI * 2) * 26}px`, '--dy': `${Math.sin((i / 6) * Math.PI * 2) * 9 - 4}px` } as React.CSSProperties} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <span key={`s${i}`} className="land-star" style={{ '--dx': `${(i - 2) * 14}px`, animationDelay: `${180 + i * 40}ms` } as React.CSSProperties}>
          ✦
        </span>
      ))}
      <DefenderFigure guardianId={guardianId} className="deploy-land absolute h-12 w-10 -translate-x-1/2 -translate-y-full" />
    </div>
  )
}
