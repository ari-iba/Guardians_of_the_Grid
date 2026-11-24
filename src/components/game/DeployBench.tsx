import { Avatar } from '#/components/game/MonsterCard.tsx'
import type { GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'

/**
 * Commander only: defenders as units. Drag one onto a monster card to deploy (assign) them,
 * or tap/Enter to pick one and then tap a monster — works on touch screens and keyboards too.
 */
export function DeployBench({
  defenders,
  glitches,
  picked,
  onPick,
  onDragState,
}: {
  defenders: Guardian[]
  glitches: GlitchSummary[]
  picked: string | null
  onPick: (guardianId: string | null) => void
  onDragState: (dragging: boolean) => void
}) {
  return (
    <section aria-label="Deploy defenders" className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
      <div className="flex flex-col">
        <span className="title-pixel text-[10px] text-neon-cyan" title="Deploy = assign a defender to a glitch">
          DEPLOY UNITS
        </span>
        <span className="text-xs text-muted">
          {picked ? 'Now tap a monster to deploy. Tap the defender again to cancel.' : 'Drag a defender onto a monster, or tap one and then a monster.'}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2 sm:ml-auto">
        {defenders.map((d) => {
          const load = glitches.filter((g) => g.assignedGuardianId === d.guardianId && g.status !== 'FIXED').length
          const active = picked === d.guardianId
          return (
            <li key={d.guardianId}>
              <button
                type="button"
                draggable
                aria-pressed={active}
                onClick={() => onPick(active ? null : d.guardianId)}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-guardian', d.guardianId)
                  e.dataTransfer.effectAllowed = 'move'
                  onDragState(true)
                }}
                onDragEnd={() => onDragState(false)}
                title={`${d.codename}: ${load} open glitch${load === 1 ? '' : 'es'} assigned`}
                className={`btn-game flex cursor-grab items-center gap-2 rounded-xl border bg-card px-2.5 py-1.5 text-sm font-semibold text-fg active:cursor-grabbing ${
                  active ? 'border-neon-cyan ring-2 ring-neon-cyan/50' : 'border-line'
                }`}
              >
                <Avatar codename={d.codename} className="size-7 text-[8px]" />
                {d.codename}
                <span className="rounded bg-subtle px-1 font-pixel text-[8px] text-muted">{load}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
