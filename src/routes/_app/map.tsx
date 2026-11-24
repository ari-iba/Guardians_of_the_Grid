import { useState } from 'react'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { WorldMap } from '#/components/map/WorldMap.tsx'
import { TimelineReplay, type ReplayState } from '#/components/TimelineReplay.tsx'
import { getDefenders } from '#/lib/glitches.functions.ts'
import { getDistrictMagic } from '#/lib/sensors.functions.ts'

export const Route = createFileRoute('/_app/map')({
  loader: async () => {
    const [magic, defenders] = await Promise.all([getDistrictMagic(), getDefenders()])
    return { magic, defenders }
  },
  head: () => ({ meta: [{ title: 'Map · Control Center' }] }),
  component: MapPage,
})

const appRoute = getRouteApi('/_app')

/** Full-screen map of Achrona (next to the sidebar), with the timeline replay. */
function MapPage() {
  const { glitches } = appRoute.useLoaderData()
  const { guardian } = appRoute.useRouteContext()
  const { magic, defenders } = Route.useLoaderData()
  const [replay, setReplay] = useState<ReplayState>(null)

  return (
    <div className="flex h-full flex-col">
      <h1 className="sr-only">Map of Achrona</h1>
      <div className="min-h-0 flex-1">
        <WorldMap
          glitches={replay?.glitches ?? glitches}
          magic={magic}
          guardian={guardian}
          defenders={defenders}
          badge={
            replay && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold tracking-wide text-white shadow-lg">
                ⏪ REPLAY · {replay.glitches.filter((g) => g.status !== 'FIXED').length} open
              </span>
            )
          }
        />
      </div>
      <div className="border-t border-line bg-app p-2 md:p-3">
        <TimelineReplay glitches={glitches} onChange={setReplay} />
      </div>
    </div>
  )
}
