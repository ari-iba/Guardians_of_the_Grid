import { useState } from 'react'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { AchronaMap } from '#/components/AchronaMap.tsx'
import { TimelineReplay, type ReplayState } from '#/components/TimelineReplay.tsx'

export const Route = createFileRoute('/_app/map')({
  head: () => ({ meta: [{ title: 'Map · Control Center' }] }),
  component: MapPage,
})

const appRoute = getRouteApi('/_app')

/** Full-screen map of Achrona (next to the sidebar), with the timeline replay. */
function MapPage() {
  const { glitches } = appRoute.useLoaderData()
  const [replay, setReplay] = useState<ReplayState>(null)

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <h1 className="sr-only">Map of Achrona</h1>
      <div className="min-h-0 flex-1 overflow-hidden">
        <AchronaMap
          glitches={(replay?.glitches ?? glitches).map((g) => ({ ...g, auto: g.source === 'auto' }))}
          badge={
            replay && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold tracking-wide text-white shadow-lg">
                ⏪ REPLAY · {replay.glitches.filter((g) => g.status !== 'FIXED').length} open
              </span>
            )
          }
        />
      </div>
      <TimelineReplay glitches={glitches} onChange={setReplay} />
    </div>
  )
}
