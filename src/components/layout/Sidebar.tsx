import {Link, useRouter} from '@tanstack/react-router'
import {Activity, LayoutGrid, LogOut, type LucideIcon} from 'lucide-react'
import {RoleBadge} from '#/components/ui/RoleBadge.tsx'
import {logout} from '#/lib/auth.functions.ts'
import type {Guardian} from '#/lib/guardian.ts'

type NavItem = {
  label: string
  icon: LucideIcon
  /** Only set for pages that already have a route. */
  to?: '/'
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: LayoutGrid, to: '/' },
]

// Icon-only items: the label lives in aria-label/title for screen readers and hover.
const itemClass =
  'flex size-12 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white'
const activeClass = 'bg-white/10 text-white'

export function Sidebar({ guardian }: { guardian: Guardian }) {
  const router = useRouter()

  async function onLogout() {
    await logout()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center bg-sidebar py-5">
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-accent-from to-accent-to text-white shadow-md shadow-black/30">
        <Activity className="size-7" strokeWidth={2} />
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-1">
        {navItems.map(({ label, icon: Icon, to }) => {
          const icon = <Icon className="size-6" strokeWidth={1.5} />
          return to ? (
            <Link
              key={label}
              to={to}
              aria-label={label}
              title={label}
              className={itemClass}
              activeOptions={{ exact: true }}
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

      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-1.5" title={`${guardian.codename} (${guardian.role})`}>
          <span className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white uppercase ring-2 ring-white/15">
            {guardian.codename.slice(0, 2)}
          </span>
          <span className="max-w-16 truncate text-xs font-medium text-white">{guardian.codename}</span>
          <RoleBadge role={guardian.role} compact />
        </div>
        <button type="button" onClick={onLogout} aria-label="Log out" title="Log out" className={itemClass}>
          <LogOut className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  )
}
