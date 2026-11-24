import { useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { CircleCheck, LoaderCircle, Route as RouteIcon, ShieldAlert, Star } from 'lucide-react'
import { useAppUi } from '#/lib/app-ui.ts'
import { GLITCH_STATUSES, type GlitchStatus, type GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'
import {
  assignGlitch,
  overrideGlitchStatus,
  resolveGlitch,
  type WorkflowOutcome,
} from '#/lib/glitches.functions.ts'
import { OVERRIDE_REASON_MAX, allowedActions } from '#/lib/workflow-rules.ts'

const inputClass =
  'rounded-xl border border-line bg-panel px-3 py-2.5 text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50'

/** Toast text for the result of a workflow action. */
export function outcomeMessage(outcome: WorkflowOutcome): string | null {
  if (outcome.changed) return `${outcome.glitchId} is now ${outcome.status}`
  return outcome.summary
}

/**
 * Workflow actions for the current guardian. Only actions the rules allow are shown;
 * the server re-validates every one of them.
 */
export function WorkflowPanel({
  glitch,
  defenders,
  guardian,
}: {
  glitch: GlitchSummary
  defenders: Guardian[]
  guardian: Guardian
}) {
  const router = useRouter()
  const { notify } = useAppUi()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overrideStatus, setOverrideStatus] = useState<GlitchStatus | ''>('')
  const [reason, setReason] = useState('')
  const actions = allowedActions(glitch, guardian)
  const isCommander = guardian.role === 'commander'

  async function run(label: string, action: () => Promise<WorkflowOutcome>) {
    setPending(label)
    setError(null)
    try {
      const outcome = await action()
      await router.invalidate()
      const message = outcomeMessage(outcome)
      // A fresh FIXED gets the layout's "✨ repaired" toast instead.
      if (message && !(outcome.changed && outcome.status === 'FIXED')) notify(message)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.')
      return false
    } finally {
      setPending(null)
    }
  }

  async function onOverride(event: FormEvent) {
    event.preventDefault()
    if (!overrideStatus) return
    const ok = await run('override', () =>
      overrideGlitchStatus({ data: { glitchId: glitch.glitchId, status: overrideStatus, reason } }),
    )
    if (ok) {
      setOverrideStatus('')
      setReason('')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-muted uppercase">
        <RouteIcon className="size-4" /> Workflow
      </h2>
      <p className="-mt-2 text-sm text-fg">{actions.hint}</p>

      {actions.resolve && (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run('resolve', () => resolveGlitch({ data: { glitchId: glitch.glitchId } }))}
          className="btn-game inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending === 'resolve' ? <LoaderCircle className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
          {isCommander ? 'Fix' : 'Mark as fixed'}
        </button>
      )}

      {isCommander && (
        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
            <Star className="size-3.5" /> Commander
          </span>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">Assigned defender</span>
            <select
              value={glitch.assignedGuardianId ?? ''}
              disabled={pending !== null || !actions.assign}
              onChange={(e) =>
                run('assign', () =>
                  assignGlitch({ data: { glitchId: glitch.glitchId, guardianId: e.target.value || null } }),
                )
              }
              className={inputClass}
            >
              <option value="" disabled={!!glitch.assignedGuardianId && !actions.unassign}>
                Unassigned
              </option>
              {defenders.map((d) => (
                <option key={d.guardianId} value={d.guardianId}>
                  {d.codename}
                </option>
              ))}
            </select>
            {!actions.assign && <span className="text-xs text-muted">Fixed glitches can’t be reassigned.</span>}
            {glitch.status === 'LEAKED' && <span className="text-xs text-muted">Assigning moves it to ASSESSING.</span>}
          </label>

          {actions.override && (
            <details className="group rounded-xl border border-line px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-fg select-none">
                <ShieldAlert className="mr-1 inline size-4 text-muted" /> Manual override
              </summary>
              <form onSubmit={onOverride} className="mt-3 flex flex-col gap-2">
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as GlitchStatus)}
                  className={inputClass}
                  aria-label="New status"
                >
                  <option value="">Choose a status…</option>
                  {GLITCH_STATUSES.filter((s) => s !== glitch.status).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={OVERRIDE_REASON_MAX}
                  placeholder="Reason (required, logged)"
                  className={inputClass}
                  aria-label="Reason"
                />
                <button
                  type="submit"
                  disabled={pending !== null || !overrideStatus || !reason.trim()}
                  className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-fg transition hover:bg-subtle disabled:opacity-40"
                >
                  {pending === 'override' ? 'Applying…' : 'Apply override'}
                </button>
              </form>
            </details>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
