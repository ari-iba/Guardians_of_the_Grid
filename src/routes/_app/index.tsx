import {useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Plus, Radar, UserRound} from 'lucide-react'
import {GlitchesTable} from '#/components/GlitchesTable.tsx'
import {ReportEchoDialog} from '#/components/ReportEchoDialog.tsx'
import {getGlitches} from '#/lib/glitches.functions.ts'

type OverviewSearch = {
  /** Only glitches assigned to the logged-in guardian. */
  mine?: boolean
}

export const Route = createFileRoute('/_app/')({
  validateSearch: (search: Record<string, unknown>): OverviewSearch => ({
    mine: search.mine === true || search.mine === 'true' ? true : undefined,
  }),
  loader: () => getGlitches(),
  component: OverviewPage,
})

function OverviewPage() {
  const glitches = Route.useLoaderData()
  const { guardian } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const [reporting, setReporting] = useState(false)

  const visible = search.mine
    ? glitches.filter((g) => g.assignedGuardianId === guardian.guardianId)
    : glitches
  const mineCount = glitches.filter((g) => g.assignedGuardianId === guardian.guardianId).length

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">Mission control</p>
          <h1 className="text-3xl font-semibold text-fg">Overview</h1>
        </div>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white shadow-md shadow-accent/25 transition hover:brightness-110"
        >
          <Plus className="size-5" /> Report echo
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!!search.mine}
          onClick={() => navigate({ search: (prev) => ({ ...prev, mine: prev.mine ? undefined : true }), replace: true })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            search.mine ? 'border-accent bg-accent text-white' : 'border-line text-fg hover:bg-subtle'
          }`}
        >
          <UserRound className="size-4" /> Assigned to me
          <span className={`rounded-full px-1.5 text-xs ${search.mine ? 'bg-white/20' : 'bg-subtle'}`}>{mineCount}</span>
        </button>
      </div>

      {glitches.length === 0 ? (
        <EmptyState onReport={() => setReporting(true)} />
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
          Nothing assigned to you right now.
        </div>
      ) : (
        <GlitchesTable glitches={visible} />
      )}

      <ReportEchoDialog open={reporting} onClose={() => setReporting(false)} />
    </div>
  )
}

function EmptyState({ onReport }: { onReport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-16 text-center">
      <Radar className="size-10 text-muted" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold text-fg">All quiet on the grid</h2>
      <p className="max-w-sm text-sm text-muted">No glitches have been reported. Seen something odd? Report the first echo.</p>
      <button type="button" onClick={onReport} className="mt-2 text-sm font-semibold text-accent hover:underline">
        Report echo
      </button>
    </div>
  )
}
