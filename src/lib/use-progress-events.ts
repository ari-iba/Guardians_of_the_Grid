import { useEffect, useRef } from 'react'
import type { AchievementId, PlayerProgress } from '#/lib/progress.ts'

type Handlers = {
  onXp: (gained: number) => void
  onLevelUp: (level: number, title: string) => void
  onAchievements: (ids: AchievementId[]) => void
}

/**
 * Watches the current player's progress across live updates and reports what changed.
 * Nothing fires on the first load or right after switching to another guardian.
 */
export function useProgressEvents(me: PlayerProgress | undefined, handlers: Handlers): void {
  const previous = useRef<{ id: string; xp: number; level: number; achievements: Set<string> } | null>(null)
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    if (!me) return
    const before = previous.current
    previous.current = { id: me.guardianId, xp: me.xp, level: me.level, achievements: new Set(me.achievements.map((a) => a.id)) }
    if (!before || before.id !== me.guardianId) return
    if (me.xp > before.xp) latest.current.onXp(me.xp - before.xp)
    if (me.level > before.level) latest.current.onLevelUp(me.level, me.title)
    const fresh = me.achievements.filter((a) => !before.achievements.has(a.id)).map((a) => a.id)
    if (fresh.length) latest.current.onAchievements(fresh)
  }, [me])
}
