import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, LoaderCircle, Sparkles, X } from 'lucide-react'
import { magicColor } from '#/components/MagicGauge.tsx'
import { StatusBadge } from '#/components/ui/StatusBadge.tsx'
import { outcomeMessage } from '#/components/WorkflowPanel.tsx'
import { useAppUi } from '#/lib/app-ui.ts'
import { DISTRICT_LABELS, type District } from '#/lib/district.ts'
import { statusIndex, type GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { assignGlitch } from '#/lib/glitches.functions.ts'

type DistrictPanelProps = {
  district: District
  glitches: GlitchSummary[]
  magic: number | undefined
  guardian: Guardian
  defenders: Guardian[]
  highlightId: string | null
  onClose: () => void
}

/** Side panel (bottom sheet on phones) with the glitches of one district. */
export function DistrictPanel({ district, glitches, magic, guardian, defenders, highlightId, onClose }: DistrictPanelProps) {
  const router = useRouter()
  const { notify } = useAppUi()
  const [pending, setPending] = useState<string | null>(null)
  const isCommander = guardian.role === 'commander'
  const panelRef = useRef<HTMLElement>(null)

  // Focus moves into the panel; Esc closes it from anywhere; focus then returns where it was.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | SVGElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previous && 'focus' in previous && document.contains(previous)) previous.focus()
    }
  }, [district])
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const list = glitches
    .filter((g) => g.district === district)
    .sort((a, b) => statusIndex(a.status) - statusIndex(b.status) || b.timestamp.localeCompare(a.timestamp))
  const open = list.filter((g) => g.status !== 'FIXED')
  const shown = [...open, ...list.filter((g) => g.status === 'FIXED').slice(0, 3)]

  async function assign(glitchId: string, guardianId: string) {
    setPending(glitchId)
    try {
      const outcome = await assignGlitch({ data: { glitchId, guardianId: guardianId || null } })
      await router.invalidate()
      const message = outcomeMessage(outcome)
      if (message) notify(message)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not assign.', 'danger')
    } finally {
      setPending(null)
    }
  }

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label={`${DISTRICT_LABELS[district]} details`}
      className="map-panel absolute outline-none inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-3xl border border-line bg-card/95 shadow-2xl backdrop-blur md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-96 md:rounded-3xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line md:hidden" />
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">District</p>
          <h2 className="font-map text-xl font-bold text-fg">{DISTRICT_LABELS[district]}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>
              <strong className="text-fg">{open.length}</strong> open glitch{open.length === 1 ? '' : 'es'}
            </span>
            {magic !== undefined && (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3.5" /> magic{' '}
                <strong style={{ color: magicColor(magic) }}>{magic}%</strong>
              </span>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close panel" className="rounded-lg p-1 text-muted hover:bg-subtle hover:text-fg">
          <X className="size-5" />
        </button>
      </header>

      <ul className="flex-1 overflow-y-auto p-3">
        {shown.length === 0 && <li className="px-2 py-8 text-center text-sm text-muted">All quiet in this district.</li>}
        {shown.map((g) => (
          <li
            key={g.glitchId}
            className={`mb-2 flex flex-col gap-2 rounded-2xl border p-3 ${
              g.glitchId === highlightId ? 'border-accent ring-2 ring-accent/25' : 'border-line'
            } ${g.status === 'FIXED' ? 'opacity-70' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-muted">
                {g.glitchId}
                {g.source === 'auto' && <span title="Auto-detected" className="ml-1">🤖</span>}
              </span>
              <StatusBadge status={g.status} />
            </div>
            <p className="text-sm text-fg">{g.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/glitches/$glitchId"
                params={{ glitchId: g.glitchId }}
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110"
              >
                Open <ArrowRight className="size-3.5" />
              </Link>
              {isCommander && g.status !== 'FIXED' ? (
                <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                  Assign
                  <select
                    value={g.assignedGuardianId ?? ''}
                    disabled={pending !== null}
                    onChange={(e) => assign(g.glitchId, e.target.value)}
                    className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-fg"
                    aria-label={`Assign ${g.glitchId}`}
                  >
                    <option value="" disabled={!!g.assignedGuardianId && g.status !== 'ASSESSING'}>
                      Unassigned
                    </option>
                    {defenders.map((d) => (
                      <option key={d.guardianId} value={d.guardianId}>
                        {d.codename}
                      </option>
                    ))}
                  </select>
                  {pending === g.glitchId && <LoaderCircle className="size-3.5 animate-spin" />}
                </label>
              ) : (
                <span className="text-xs text-muted">{g.assignedCodename ? `Assigned to ${g.assignedCodename}` : 'Unassigned'}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
