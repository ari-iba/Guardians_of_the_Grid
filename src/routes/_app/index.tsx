import {useEffect, useMemo, useRef, useState} from 'react'
import {createFileRoute, getRouteApi, useNavigate} from '@tanstack/react-router'
import {ArrowDownUp, Map as MapIcon, Plus, Radar, Search, SearchX, UserRound, X} from 'lucide-react'
import {AchronaMap} from '#/components/AchronaMap.tsx'
import {GlitchesTable} from '#/components/GlitchesTable.tsx'
import {Card} from '#/components/ui/Card.tsx'
import {DISTRICT_LABELS, isDistrict, type District} from '#/lib/district.ts'
import {LiveIndicator} from '#/components/LiveIndicator.tsx'
import {MagicGauge} from '#/components/MagicGauge.tsx'
import {RepairParticles} from '#/components/RepairParticles.tsx'
import {statusStyles} from '#/components/ui/StatusBadge.tsx'
import {useAppUi} from '#/lib/app-ui.ts'
import {GLITCH_STATUSES, statusIndex, type GlitchStatus, type GlitchSummary} from '#/lib/glitch.ts'
import {useHotkeys} from '#/lib/hotkeys.ts'

const SORTS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  status: 'Most urgent first',
} as const
type Sort = keyof typeof SORTS

type OverviewSearch = {
  q?: string
  status?: GlitchStatus
  district?: District
  sort?: Sort
  /** Only glitches assigned to the logged-in guardian. */
  mine?: boolean
}

export const Route = createFileRoute('/_app/')({
  validateSearch: (search: Record<string, unknown>): OverviewSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q.slice(0, 100) : undefined,
    status: GLITCH_STATUSES.find((s) => s === search.status),
    district: isDistrict(search.district) ? search.district : undefined,
    sort: typeof search.sort === 'string' && search.sort in SORTS && search.sort !== 'newest' ? (search.sort as Sort) : undefined,
    mine: search.mine === true || search.mine === 'true' ? true : undefined,
  }),
  component: OverviewPage,
})

const appRoute = getRouteApi('/_app')

function applySearch(glitches: GlitchSummary[], search: OverviewSearch, guardianId: string): GlitchSummary[] {
  const q = search.q?.trim().toLowerCase()
  const filtered = glitches.filter(
    (g) =>
      (!search.mine || g.assignedGuardianId === guardianId) &&
      (!search.status || g.status === search.status) &&
      (!search.district || g.district === search.district) &&
      (!q || g.glitchId.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)),
  )
  const sort = search.sort ?? 'newest'
  return filtered.sort((a, b) => {
    if (sort === 'status') {
      const byStatus = statusIndex(a.status) - statusIndex(b.status)
      if (byStatus !== 0) return byStatus
    }
    const byTime = a.timestamp.localeCompare(b.timestamp)
    return sort === 'oldest' ? byTime : -byTime
  })
}

/** Ids that appeared since the previous render of `glitches` (not on first load). */
function useFreshIds(glitches: GlitchSummary[]): ReadonlySet<string> {
  const known = useRef<Set<string> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const ids = new Set(glitches.map((g) => g.glitchId))
    const previous = known.current
    known.current = ids
    if (!previous) return
    const added = [...ids].filter((id) => !previous.has(id))
    if (added.length === 0) return
    setFresh(new Set(added))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setFresh(new Set()), 4000)
  }, [glitches])

  useEffect(() => () => clearTimeout(timer.current), [])
  return fresh
}

function OverviewPage() {
  const { glitches } = appRoute.useLoaderData()
  const { guardian } = appRoute.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const { openReport } = useAppUi()
  const searchRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fresh = useFreshIds(glitches)

  const visible = useMemo(() => applySearch(glitches, search, guardian.guardianId), [glitches, search, guardian.guardianId])
  const mineCount = glitches.filter((g) => g.assignedGuardianId === guardian.guardianId).length
  const filtering = !!(search.q || search.status || search.mine || search.district)

  const setSearch = (patch: Partial<OverviewSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  // Keep the keyboard selection visible.
  useEffect(() => {
    if (!selectedId) return
    const rows = document.querySelectorAll<HTMLElement>(`[data-glitch-row="${selectedId}"]`)
    ;[...rows].find((el) => el.offsetParent !== null)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const move = (delta: 1 | -1) => {
    if (visible.length === 0) return
    const index = visible.findIndex((g) => g.glitchId === selectedId)
    const next = index === -1 ? (delta === 1 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, index + delta))
    setSelectedId(visible[next].glitchId)
  }

  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    Enter: () => {
      if (selectedId) navigate({ to: '/glitches/$glitchId', params: { glitchId: selectedId } })
    },
    '/': () => searchRef.current?.focus(),
  })

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">Mission control</p>
          <h1 className="text-3xl font-semibold text-fg">Overview</h1>
          <LiveIndicator />
        </div>
        <button
          type="button"
          onClick={openReport}
          title="Report echo (n)"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white shadow-md shadow-accent/25 transition hover:brightness-110"
        >
          <Plus className="size-5" /> Report echo
        </button>
      </header>

      <MagicGauge glitches={glitches} />
      <RepairParticles />

      <Card className="flex flex-col gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
            <MapIcon className="size-4" /> Map of Achrona
          </h2>
          <p className="text-xs text-muted">
            {search.district ? (
              <>
                Showing {DISTRICT_LABELS[search.district]} ·{' '}
                <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setSearch({ district: undefined })}>
                  show all
                </button>
              </>
            ) : (
              'Click a district to filter, a marker to open the glitch.'
            )}
          </p>
        </div>
        <AchronaMap
          glitches={glitches.map((g) => ({ ...g, auto: g.source === 'auto' }))}
          activeDistrict={search.district}
          onDistrictClick={(district) => setSearch({ district: search.district === district ? undefined : district })}
        />
      </Card>

      {glitches.length === 0 ? (
        <EmptyState onReport={openReport} />
      ) : (
        <section className="flex flex-col gap-4" aria-label="Glitches">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search glitches</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                type="search"
                value={search.q ?? ''}
                onChange={(e) => setSearch({ q: e.target.value || undefined })}
                onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
                placeholder="Search by description or id…"
                className="w-full rounded-xl border border-line bg-panel py-2.5 pr-12 pl-10 text-fg outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-xs text-muted sm:block">
                /
              </kbd>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={!search.status} onClick={() => setSearch({ status: undefined })}>
                All
              </FilterChip>
              {GLITCH_STATUSES.map((status) => (
                <FilterChip
                  key={status}
                  active={search.status === status}
                  onClick={() => setSearch({ status: search.status === status ? undefined : status })}
                >
                  <span className={`size-2 rounded-full ${statusStyles[status].dot}`} />
                  {statusStyles[status].label}
                </FilterChip>
              ))}
              <FilterChip active={!!search.mine} onClick={() => setSearch({ mine: search.mine ? undefined : true })}>
                <UserRound className="size-3.5" /> Assigned to me
                <span className={`rounded-full px-1.5 text-xs ${search.mine ? 'bg-white/20' : 'bg-subtle'}`}>{mineCount}</span>
              </FilterChip>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <ArrowDownUp className="size-4" />
              <span className="sr-only">Sort</span>
              <select
                value={search.sort ?? 'newest'}
                onChange={(e) => setSearch({ sort: e.target.value === 'newest' ? undefined : (e.target.value as Sort) })}
                className="rounded-xl border border-line bg-panel px-3 py-2 text-fg outline-none focus:border-accent"
              >
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-sm text-muted" aria-live="polite">
            Showing {visible.length} of {glitches.length} glitch{glitches.length === 1 ? '' : 'es'}
            {filtering && (
              <button
                type="button"
                onClick={() => setSearch({ q: undefined, status: undefined, mine: undefined, district: undefined })}
                className="ml-2 inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
              >
                <X className="size-3.5" /> Clear filters
              </button>
            )}
            {fresh.size > 0 && (
              <span className="ml-2 font-semibold text-accent">
                · New: {[...fresh].join(', ')}
              </span>
            )}
          </p>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
              <SearchX className="size-8 text-muted" strokeWidth={1.5} />
              <p className="text-sm text-muted">
                {search.mine && !search.q && !search.status ? 'Nothing is assigned to you right now.' : 'No glitches match these filters.'}
              </p>
            </div>
          ) : (
            <GlitchesTable glitches={visible} selectedId={selectedId} freshIds={fresh} />
          )}
          <p className="hidden text-xs text-muted md:block">
            Tip: <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> to move,{' '}
            <kbd className="font-mono">Enter</kbd> to open, <kbd className="font-mono">?</kbd> for all shortcuts.
          </p>
        </section>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active ? 'border-accent bg-accent text-white' : 'border-line text-fg hover:bg-subtle'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState({ onReport }: { onReport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-16 text-center">
      <Radar className="size-10 text-muted" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold text-fg">All quiet on the grid</h2>
      <p className="max-w-sm text-sm text-muted">No glitches have been reported. Seen something odd? Report the first echo.</p>
      <button type="button" onClick={onReport} className="mt-2 text-sm font-semibold text-accent hover:underline">
        Report echo
      </button>
    </div>
  )
}
