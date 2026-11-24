import { useState } from 'react'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { WorldMap } from '#/components/map/WorldMap.tsx'
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
      <div className="min-h-0 flex-1">
        <WorldMap glitches={replay?.glitches ?? glitches} />
      </div>
      <TimelineReplay glitches={glitches} onChange={setReplay} />
    </div>
  )
}
