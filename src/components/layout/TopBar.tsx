import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, ChartSpline, LayoutGrid, LogOut, Map as MapIcon, ScrollText, Trophy, Volume2, VolumeX, type LucideIcon } from 'lucide-react'
import { ThemeToggle } from '#/components/ThemeToggle.tsx'
import { Avatar } from '#/components/game/MonsterCard.tsx'
import { LevelBadge, XpBar } from '#/components/game/XpBar.tsx'
import { RoleBadge } from '#/components/ui/RoleBadge.tsx'
import type { PlayerProgress } from '#/lib/progress.ts'
import type { Theme } from '#/lib/theme.ts'

export type XpPopup = { id: number; xp: number }

type NavItem = { label: string; short: string; icon: LucideIcon; to: '/' | '/map' | '/sensors' | '/leaderboard' }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', short: 'Overview', icon: LayoutGrid, to: '/' },
  { label: 'Map', short: 'Map', icon: MapIcon, to: '/map' },
  { label: 'Sensors', short: 'Sensors', icon: ChartSpline, to: '/sensors' },
  { label: 'Leaderboard', short: 'Scores', icon: Trophy, to: '/leaderboard' },
]

const iconButton =
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
      <span className="hidden max-w-24 truncate text-sm font-semibold text-fg lg:inline">{me.codename}</span>
      <span className="hidden lg:contents">
        <RoleBadge role={me.role} compact />
      </span>
    </Link>
  )
}

type TopBarProps = {
  me: PlayerProgress | undefined
  identity: ReactNode
  xpPopups: XpPopup[]
  sound: boolean
  onToggleSound: () => void
  theme: Theme | null
  onToggleTheme: () => void
  onLogout: () => void
  onOpenQuests: () => void
}

/**
 * One fixed bar over the full width: logo, the main tabs (desktop), and on the right the
 * player's level/XP, quests, sound, theme, the guardian (switcher) and log out.
 */
export function TopBar({ me, identity, xpPopups, sound, onToggleSound, theme, onToggleTheme, onLogout, onOpenQuests }: TopBarProps) {
  const questsDone = me?.quests.filter((q) => q.done).length ?? 0
  const questsTotal = me?.quests.length ?? 0

  return (
    <header className="topbar sticky top-0 z-40 border-b border-[var(--panel-border)] bg-panel/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-2 sm:px-3 md:gap-3 md:px-5">
        <Link to="/" aria-label="Guardians of the Grid — overview" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-accent-from to-accent-to text-white shadow-[0_0_14px_-2px_var(--glow)] md:size-10">
            <Activity className="size-5 md:size-6" strokeWidth={2} />
          </span>
          <span className="hidden font-pixel text-[9px] leading-[1.5] text-fg xl:block">
            GUARDIANS
            <br />
            OF THE GRID
          </span>
        </Link>

        {/* Desktop / tablet tabs */}
        <nav aria-label="Main" className="hidden h-full flex-1 items-stretch justify-center gap-1 md:flex">
          {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
            <Link
              key={to}
              to={to}
              title={label}
              activeOptions={{ exact: true, includeSearch: false }}
              className="nav-tab flex items-center gap-2 px-3 text-sm font-semibold text-muted transition-colors hover:text-fg lg:px-4"
            >
              <Icon className="size-5" strokeWidth={1.75} />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1 md:ml-0">
          {me && (
            <Link
              to="/guardians/$guardianId"
              params={{ guardianId: me.guardianId }}
              className="relative mr-1 flex min-w-0 items-center gap-2"
              aria-label={`Level ${me.level}, ${me.xp} XP — open your character card`}
            >
              <LevelBadge player={me} />
              <XpBar player={me} className="w-12 sm:w-24 lg:w-32" showNumbers={false} />
              {xpPopups.map((p) => (
                <span key={p.id} aria-live="polite" className="xp-popup pointer-events-none absolute -top-1 left-10 font-pixel text-xs whitespace-nowrap text-neon-gold">
                  +{p.xp} XP
                </span>
              ))}
            </Link>
          )}
          {me && (
            <button
              type="button"
              onClick={onOpenQuests}
              aria-label={`Daily quests: ${questsDone} of ${questsTotal} done`}
              title={`Daily quests (q) — ${questsDone}/${questsTotal} done`}
              className={iconButton}
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
          )}
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={sound}
            aria-label={sound ? 'Turn sound effects off' : 'Turn sound effects on'}
            title={sound ? 'Sound effects: on' : 'Sound effects: off'}
            className={iconButton}
          >
            {sound ? <Volume2 className="size-5" strokeWidth={1.75} /> : <VolumeX className="size-5" strokeWidth={1.75} />}
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className={iconButton} />
          {identity}
          <button type="button" onClick={onLogout} aria-label="Log out" title="Log out" className={iconButton}>
            <LogOut className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  )
}

/** Phones: the main tabs as a fixed bar at the bottom (icon + short label). */
export function BottomTabs() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--panel-border)] bg-panel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {NAV_ITEMS.map(({ label, short, icon: Icon, to }) => (
        <Link
          key={to}
          to={to}
          aria-label={label}
          activeOptions={{ exact: true, includeSearch: false }}
          className="bottom-tab flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted"
        >
          <Icon className="size-5" strokeWidth={1.75} />
          {short}
        </Link>
      ))}
    </nav>
  )
}
