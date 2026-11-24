import { MonsterCard } from '#/components/game/MonsterCard.tsx'
import type { GlitchSummary } from '#/lib/glitch.ts'

/** The overview as a bestiary: one monster card per glitch. */
export function MonsterGrid({
  glitches,
  selectedId,
  freshIds,
  bossId,
}: {
  glitches: GlitchSummary[]
  selectedId?: string | null
  freshIds?: ReadonlySet<string>
  bossId?: string | null
}) {
  return (
    <ul className="grid gap-x-4 gap-y-5 pt-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {glitches.map((glitch) => (
        <li key={glitch.glitchId} className="min-w-0">
          <MonsterCard
            glitch={glitch}
            selected={selectedId === glitch.glitchId}
            fresh={freshIds?.has(glitch.glitchId)}
            boss={bossId === glitch.glitchId}
          />
        </li>
      ))}
    </ul>
  )
}
