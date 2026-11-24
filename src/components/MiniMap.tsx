import { Link } from '@tanstack/react-router'
import { ArrowRight, Map as MapIcon } from 'lucide-react'
import { AchronaMap } from '#/components/AchronaMap.tsx'
import { Card } from '#/components/ui/Card.tsx'
import type { GlitchSummary } from '#/lib/glitch.ts'

/** Small, static map preview for the overview, linking to the full /map tab. */
export function MiniMap({ glitches }: { glitches: GlitchSummary[] }) {
  const open = glitches.filter((g) => g.status !== 'FIXED').length
  return (
    <Card className="flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
          <MapIcon className="size-4" /> Map of Achrona
        </h2>
        <span className="text-xs text-muted">{open} open</span>
      </div>
      <div className="pointer-events-none" aria-hidden>
        <AchronaMap glitches={glitches} readOnly />
      </div>
      <Link
        to="/map"
        className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/15"
      >
        Open map <ArrowRight className="size-4" />
      </Link>
    </Card>
  )
}
