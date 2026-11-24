import {useState} from 'react'
import {createFileRoute} from '@tanstack/react-router'
import {Plus, Radar} from 'lucide-react'
import {GlitchesTable} from '#/components/GlitchesTable.tsx'
import {ReportEchoDialog} from '#/components/ReportEchoDialog.tsx'
import {getGlitches} from '#/lib/glitches.functions.ts'

export const Route = createFileRoute('/_app/')({
  loader: () => getGlitches(),
  component: OverviewPage,
})

function OverviewPage() {
  const glitches = Route.useLoaderData()
  const [reporting, setReporting] = useState(false)

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

      {glitches.length === 0 ? (
        <EmptyState onReport={() => setReporting(true)} />
      ) : (
        <GlitchesTable glitches={glitches} />
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
