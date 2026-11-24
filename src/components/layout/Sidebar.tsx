import {Link, useRouter} from '@tanstack/react-router'
import {Activity, ChartSpline, Keyboard, LayoutGrid, LogOut, Trophy, Volume2, VolumeX, type LucideIcon} from 'lucide-react'
import {ThemeToggle} from '#/components/ThemeToggle.tsx'
import {RoleBadge} from '#/components/ui/RoleBadge.tsx'
import {logout} from '#/lib/auth.functions.ts'
import type {Guardian} from '#/lib/guardian.ts'
import type {Theme} from '#/lib/theme.ts'

type NavItem = {
  label: string
  icon: LucideIcon
  /** Only set for pages that already have a route. */
  to?: '/' | '/sensors' | '/leaderboard'
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: LayoutGrid, to: '/' },
  { label: 'Sensors', icon: ChartSpline, to: '/sensors' },
  { label: 'Leaderboard', icon: Trophy, to: '/leaderboard' },
]

// Icon-only items: the label lives in aria-label/title for screen readers and hover.
const itemClass =
  'flex size-10 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white md:size-12'
const activeClass = 'bg-white/10 text-white'

type SidebarProps = {
  guardian: Guardian
  theme: Theme | null
  onToggleTheme: () => void
  onShowShortcuts: () => void
  sound: boolean
  onToggleSound: () => void
}

/** Vertical rail on tablets/desktop, compact top bar on phones. */
export function Sidebar({ guardian, theme, onToggleTheme, onShowShortcuts, sound, onToggleSound }: SidebarProps) {
  const router = useRouter()

  async function onLogout() {
    await logout()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <aside className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center gap-1 bg-sidebar px-3 transition-colors duration-500 md:h-screen md:w-20 md:flex-col md:gap-0 md:px-0 md:py-5">
      <Link
        to="/"
        aria-label="Mission control home"
        className="mr-2 flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-accent-from to-accent-to text-white shadow-md shadow-black/30 md:mr-0 md:mb-6 md:size-12"
      >
        <Activity className="size-6 md:size-7" strokeWidth={2} />
      </Link>

      <nav className="flex flex-1 items-center gap-1 md:w-full md:flex-col">
        {navItems.map(({ label, icon: Icon, to }) => {
          const icon = <Icon className="size-6" strokeWidth={1.5} />
          return to ? (
            <Link
              key={label}
              to={to}
              aria-label={label}
              title={label}
              className={itemClass}
              activeOptions={{ exact: true, includeSearch: false }}
              activeProps={{ className: activeClass }}
            >
              {icon}
            </Link>
          ) : (
            <button key={label} type="button" aria-label={label} title={label} className={itemClass}>
              {icon}
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-1 md:w-full md:flex-col md:gap-2">
        <button type="button" onClick={onShowShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" className={`${itemClass} hidden md:flex`}>
          <Keyboard className="size-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={sound}
          aria-label={sound ? 'Turn sound effects off' : 'Turn sound effects on'}
          title={sound ? 'Sound effects: on' : 'Sound effects: off'}
          className={`${itemClass} hidden sm:flex`}
        >
          {sound ? <Volume2 className="size-5" strokeWidth={1.75} /> : <VolumeX className="size-5" strokeWidth={1.75} />}
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className={itemClass} />

        <div
          className="mx-1 flex items-center gap-2 md:mx-0 md:my-2 md:flex-col md:gap-1.5"
          title={`${guardian.codename} (${guardian.role})`}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white uppercase ring-2 ring-white/15 md:size-10">
            {guardian.codename.slice(0, 2)}
          </span>
          <span className="hidden max-w-16 truncate text-xs font-medium text-white sm:inline">{guardian.codename}</span>
          <RoleBadge role={guardian.role} compact />
        </div>

        <button type="button" onClick={onLogout} aria-label="Log out" title="Log out" className={itemClass}>
          <LogOut className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  )
}
