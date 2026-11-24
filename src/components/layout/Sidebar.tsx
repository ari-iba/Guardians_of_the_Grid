import {Link} from '@tanstack/react-router'
import {Activity, ChartSpline, Keyboard, LayoutGrid, Map as MapIcon, Trophy, type LucideIcon} from 'lucide-react'
import {ThemeToggle} from '#/components/ThemeToggle.tsx'
import type {Theme} from '#/lib/theme.ts'

type NavItem = {
  label: string
  icon: LucideIcon
  to: '/' | '/map' | '/sensors' | '/leaderboard'
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: LayoutGrid, to: '/' },
  { label: 'Map', icon: MapIcon, to: '/map' },
  { label: 'Sensors', icon: ChartSpline, to: '/sensors' },
  { label: 'Highscores', icon: Trophy, to: '/leaderboard' },
]

// Icon-only items: the label lives in aria-label/title for screen readers and hover.
const itemClass =
  'flex size-10 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white md:size-12'
const activeClass = 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15),0_0_14px_-4px_var(--glow)]'

type SidebarProps = {
  theme: Theme | null
  onToggleTheme: () => void
  onShowShortcuts: () => void
}

/** Vertical rail on tablets/desktop, compact top bar on phones. Player info lives in the HUD. */
export function Sidebar({ theme, onToggleTheme, onShowShortcuts }: SidebarProps) {
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
        {navItems.map(({ label, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            aria-label={label}
            title={label}
            className={itemClass}
            activeOptions={{ exact: true, includeSearch: false }}
            activeProps={{ className: activeClass }}
          >
            <Icon className="size-6" strokeWidth={1.5} />
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1 md:w-full md:flex-col md:gap-2">
        <button type="button" onClick={onShowShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" className={`${itemClass} hidden md:flex`}>
          <Keyboard className="size-5" strokeWidth={1.75} />
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className={itemClass} />
      </div>
    </aside>
  )
}
