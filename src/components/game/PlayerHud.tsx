import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { LogOut, ScrollText, Volume2, VolumeX } from 'lucide-react'
import { Avatar } from '#/components/game/MonsterCard.tsx'
import { LevelBadge, XpBar } from '#/components/game/XpBar.tsx'
import { RoleBadge } from '#/components/ui/RoleBadge.tsx'
import type { PlayerProgress } from '#/lib/progress.ts'

export type XpPopup = { id: number; xp: number }

const hudButton =
  'relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-subtle hover:text-fg md:size-10'

/** Static identity (no demo switcher): avatar, codename and role, linking to the profile. */
export function HudIdentity({ me }: { me: PlayerProgress }) {
  return (
    <Link
      to="/guardians/$guardianId"
      params={{ guardianId: me.guardianId }}
      title={`${me.codename} (${me.role}) — open your character card`}
      className="flex min-w-0 items-center gap-2 rounded-lg p-1 hover:bg-subtle"
    >
      <Avatar codename={me.codename} className="size-8 text-[9px]" />
      <span className="hidden max-w-24 truncate text-sm font-semibold text-fg sm:inline">{me.codename}</span>
      <span className="hidden sm:contents">
        <RoleBadge role={me.role} compact />
      </span>
    </Link>
  )
}

/** Top bar: who you are, your level and XP, quests, sound and log out. */
export function PlayerHud({
  me,
  identity,
  xpPopups,
  sound,
  onToggleSound,
  onLogout,
  questsDone,
  questsTotal,
  onOpenQuests,
}: {
  me: PlayerProgress
  identity: ReactNode
  xpPopups: XpPopup[]
  sound: boolean
  onToggleSound: () => void
  onLogout: () => void
  questsDone: number
  questsTotal: number
  onOpenQuests: () => void
}) {
  return (
    <div className="flex h-12 items-center gap-1.5 border-b border-[var(--panel-border)] bg-panel/85 px-2 backdrop-blur-md sm:gap-3 md:h-14 md:px-6">
      {identity}

      <Link
        to="/guardians/$guardianId"
        params={{ guardianId: me.guardianId }}
        className="relative flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs"
        aria-label={`Level ${me.level}, ${me.xp} XP — open your character card`}
      >
        <LevelBadge player={me} />
        <XpBar player={me} className="flex-1" />
        <span className="hidden font-pixel text-[8px] whitespace-nowrap text-muted lg:inline" title={`Your title at level ${me.level}`}>
          {me.title}
        </span>
        {xpPopups.map((p) => (
          <span key={p.id} aria-live="polite" className="xp-popup pointer-events-none absolute -top-1 left-10 font-pixel text-xs whitespace-nowrap text-neon-gold">
            +{p.xp} XP
          </span>
        ))}
      </Link>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={onOpenQuests}
          aria-label={`Daily quests: ${questsDone} of ${questsTotal} done`}
          title={`Daily quests (q) — ${questsDone}/${questsTotal} done`}
          className={hudButton}
        >
          <ScrollText className="size-5" strokeWidth={1.75} />
          <span
            className={`absolute -top-0.5 -right-0.5 rounded px-1 font-pixel text-[7px] leading-3 ${
              questsDone === questsTotal ? 'bg-emerald-500 text-white' : 'bg-neon-gold text-black'
            }`}
          >
            {questsDone}/{questsTotal}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={sound}
          aria-label={sound ? 'Turn sound effects off' : 'Turn sound effects on'}
          title={sound ? 'Sound effects: on' : 'Sound effects: off'}
          className={hudButton}
        >
          {sound ? <Volume2 className="size-5" strokeWidth={1.75} /> : <VolumeX className="size-5" strokeWidth={1.75} />}
        </button>
        <button type="button" onClick={onLogout} aria-label="Log out" title="Log out" className={hudButton}>
          <LogOut className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
