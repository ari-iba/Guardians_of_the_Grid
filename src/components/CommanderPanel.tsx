import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, LoaderCircle, Star } from 'lucide-react'
import { stepStatus, type GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { assignGlitch, stepGlitchStatus } from '#/lib/glitches.functions.ts'

const buttonClass =
  'inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-fg transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40'

/** Commander-only controls. The server re-checks the role on every action. */
export function CommanderPanel({ glitch, defenders }: { glitch: GlitchSummary; defenders: Guardian[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const previous = stepStatus(glitch.status, -1)
  const next = stepStatus(glitch.status, 1)

  async function run(label: string, action: () => Promise<unknown>) {
    setPending(label)
    setError(null)
    try {
      await action()
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
        <Star className="size-4" /> Commander controls
      </h2>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">Status</span>
        <div className="flex gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={!previous || pending !== null}
            onClick={() => run('prev', () => stepGlitchStatus({ data: { glitchId: glitch.glitchId, direction: -1 } }))}
            title={previous ? `Back to ${previous}` : 'Already at the first step'}
          >
            {pending === 'prev' ? <LoaderCircle className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
            {previous ?? '—'}
          </button>
          <button
            type="button"
            className={`${buttonClass} border-accent/40 bg-accent/10 text-accent hover:bg-accent/15`}
            disabled={!next || pending !== null}
            onClick={() => run('next', () => stepGlitchStatus({ data: { glitchId: glitch.glitchId, direction: 1 } }))}
            title={next ? `Advance to ${next}` : 'Already fixed'}
          >
            {next ?? 'Done'}
            {pending === 'next' ? <LoaderCircle className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">Assigned defender</span>
        <select
          value={glitch.assignedGuardianId ?? ''}
          disabled={pending !== null}
          onChange={(e) =>
            run('assign', () =>
              assignGlitch({ data: { glitchId: glitch.glitchId, guardianId: e.target.value || null } }),
            )
          }
          className="rounded-xl border border-line bg-panel px-3 py-2.5 text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        >
          <option value="">Unassigned</option>
          {defenders.map((d) => (
            <option key={d.guardianId} value={d.guardianId}>
              {d.codename}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
