import type { PlayerProgress } from '#/lib/progress.ts'

export const XP_TOOLTIP = 'XP = experience points. Earn them by reporting echoes (+10), getting assigned (+5), containing (+15) and fixing glitches (+50), and with daily quests.'

/** Progress towards the next level. */
export function XpBar({ player, className = '', showNumbers = true }: { player: PlayerProgress; className?: string; showNumbers?: boolean }) {
  const span = player.nextLevelAt - player.levelFloor
  const into = player.xp - player.levelFloor
  const pct = Math.max(0, Math.min(100, (into / span) * 100))
  const tip = `${XP_TOOLTIP} ${player.xp} XP now, ${player.nextLevelAt - player.xp} XP to level ${player.level + 1}.`
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`} title={tip}>
      <div
        role="meter"
        aria-label={`Experience: ${player.xp} XP, level ${player.level}`}
        aria-valuemin={player.levelFloor}
        aria-valuemax={player.nextLevelAt}
        aria-valuenow={player.xp}
        className="relative h-2.5 cursor-help overflow-hidden rounded-full border border-black/30 bg-black/25"
      >
        <div
          className="xp-fill absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-neon-cyan via-neon-magenta to-neon-gold"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showNumbers && (
        <span className="font-pixel text-[8px] leading-none text-muted tabular-nums">
          {player.xp - player.levelFloor}/{span} XP
        </span>
      )}
    </div>
  )
}

export function LevelBadge({ player, className = '' }: { player: PlayerProgress; className?: string }) {
  return (
    <span
      title={`Level ${player.level} — ${player.title}. Levels go up with XP.`}
      className={`inline-flex shrink-0 cursor-help items-center gap-1 rounded-md bg-neon-gold px-1.5 py-1 font-pixel text-[9px] leading-none text-black shadow-[0_2px_0_rgb(0_0_0/0.35)] ${className}`}
    >
      LV {player.level}
    </span>
  )
}
