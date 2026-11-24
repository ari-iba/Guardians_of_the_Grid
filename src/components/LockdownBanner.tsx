import { Link } from '@tanstack/react-router'
import { Siren, Swords } from 'lucide-react'
import { HpBar } from '#/components/game/HpBar.tsx'
import { MonsterSprite } from '#/components/game/MonsterSprite.tsx'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'
import { bossOf, monsterName } from '#/lib/monster.ts'

/**
 * Lockdown = Boss Battle: the biggest open glitch becomes the BOSS, with a big HP bar on top.
 * The plain explanation stays visible underneath, so nobody has to guess what is going on.
 */
export function LockdownBanner({ magic, leaked, glitches }: { magic: number; leaked: number; glitches: GlitchSummary[] }) {
  const boss = bossOf(glitches)
  return (
    <div
      role="alert"
      className="lockdown-banner boss-banner flex flex-col gap-2 bg-red-700 px-3 py-2.5 text-white shadow-lg shadow-red-900/30 sm:flex-row sm:items-center sm:gap-4 md:px-8"
    >
      <div className="flex shrink-0 flex-col" title="Lockdown: magic below 40% or 3+ glitches LEAKED">
        <span className="boss-title inline-flex items-center gap-2 font-pixel text-xs sm:text-sm">
          <Swords className="size-4 sm:size-5" /> BOSS BATTLE
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-white/85">
          <Siren className="size-3.5 animate-pulse" />
          LOCKDOWN · magic {magic}% · {leaked} leaked
        </span>
      </div>
      {boss && (
        <Link
          to="/glitches/$glitchId"
          params={{ glitchId: boss.glitchId }}
          title={`BOSS = the biggest open glitch (${boss.glitchId}). Defeat it to turn the tide.`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-black/25 px-2 py-1.5 hover:bg-black/35"
        >
          <MonsterSprite glitch={boss} className="monster-idle size-10 shrink-0" title={monsterName(boss)} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-xs font-semibold">
              <span className="font-pixel text-[9px] text-red-200">BOSS</span> {monsterName(boss)} · {boss.glitchId} · {DISTRICT_LABELS[boss.district]}
            </span>
            <span className="[&_.text-muted]:text-white/70 [&_.text-fg]:text-white">
              <HpBar status={boss.status} size="lg" />
            </span>
          </span>
        </Link>
      )}
    </div>
  )
}
