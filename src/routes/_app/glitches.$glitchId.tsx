import { Link, createFileRoute, getRouteApi, notFound, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeft, CalendarClock, Check, Cog, MapPin, MessageSquareText, SearchX, UserRound } from 'lucide-react'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import { METRIC_LABELS, TRIGGER_LABELS } from '#/lib/sensors.ts'
import { EchoForm } from '#/components/EchoForm.tsx'
import { WorkflowPanel, outcomeMessage } from '#/components/WorkflowPanel.tsx'
import { useAppUi, useNow } from '#/lib/app-ui.ts'
import { Card } from '#/components/ui/Card.tsx'
import { StatusBadge, statusStyles } from '#/components/ui/StatusBadge.tsx'
import { formatTimestamp, timeAgo } from '#/lib/format.ts'
import { GLITCH_STATUSES, statusIndex, type GlitchStatus } from '#/lib/glitch.ts'
import { getDefenders, getGlitch } from '#/lib/glitches.functions.ts'
import { useHotkeys } from '#/lib/hotkeys.ts'

const appRoute = getRouteApi('/_app')

export const Route = createFileRoute('/_app/glitches/$glitchId')({
  loader: async ({ params }) => {
    if (!/^GL-\d{1,8}$/.test(params.glitchId)) throw notFound()
    const [detail, defenders] = await Promise.all([
      getGlitch({ data: { glitchId: params.glitchId } }),
      getDefenders(),
    ])
    if (!detail) throw notFound()
    return { ...detail, defenders }
  },
  head: ({ params }) => ({ meta: [{ title: `${params.glitchId} · Control Center` }] }),
  component: GlitchPage,
  notFoundComponent: GlitchNotFound,
})

function GlitchPage() {
  const { glitch, echoes, defenders } = Route.useLoaderData()
  const { guardian } = Route.useRouteContext()
  const router = useRouter()
  const { notify } = useAppUi()
  const assignedToMe = glitch.assignedGuardianId === guardian.guardianId

  // j/k step through the overview list (newest first) without going back.
  const { glitches: all } = appRoute.useLoaderData()
  const navigate = useNavigate()
  const index = all.findIndex((g) => g.glitchId === glitch.glitchId)
  const go = (delta: 1 | -1) => {
    const target = all[index + delta]
    if (target) navigate({ to: '/glitches/$glitchId', params: { glitchId: target.glitchId } })
  }
  useHotkeys({ j: () => go(1), k: () => go(-1) })

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-semibold text-muted">{glitch.glitchId}</span>
          <StatusBadge status={glitch.status} />
          {glitch.source === 'auto' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-muted">
              🤖 Auto-detected · {glitch.trigger ? TRIGGER_LABELS[glitch.trigger] : 'Desync Engine'}
              {glitch.metric && ` (${METRIC_LABELS[glitch.metric]})`}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-fg md:text-3xl">{glitch.description}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <div className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4" />
            <dt className="sr-only">Reported</dt>
            <dd>
              <time dateTime={glitch.timestamp} suppressHydrationWarning>
                {formatTimestamp(glitch.timestamp)}
              </time>
            </dd>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" />
            <dt className="sr-only">District</dt>
            <dd>{DISTRICT_LABELS[glitch.district]}</dd>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <UserRound className="size-4" />
            <dt className="sr-only">Assigned to</dt>
            <dd>{glitch.assignedCodename ? `Assigned to ${glitch.assignedCodename}` : 'Unassigned'}</dd>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <MessageSquareText className="size-4" />
            <dt className="sr-only">Echoes</dt>
            <dd>
              {glitch.echoCount} echo{glitch.echoCount === 1 ? '' : 'es'}
            </dd>
          </div>
        </dl>
      </header>

      <Card className="p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">Lifecycle</h2>
        <StatusStepper status={glitch.status} since={glitch.statusChangedAt} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card className="p-5 md:p-6">
          <h2 className="mb-5 text-sm font-semibold tracking-wide text-muted uppercase">Echo timeline</h2>
          {echoes.length === 0 ? (
            <p className="text-sm text-muted">No echoes yet.</p>
          ) : (
            <ol className="relative flex flex-col gap-6 border-l-2 border-line pl-6">
              {echoes.map((echo, i) =>
                echo.kind === 'audit' ? (
                  <li key={echo.echoId} className="relative">
                    <span className="absolute top-1 -left-[33px] flex size-4 items-center justify-center rounded-full bg-subtle ring-4 ring-card">
                      <Cog className="size-3 text-muted" />
                    </span>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                      <span className="font-mono font-semibold tracking-wide">SYSTEM</span>
                      <span className="text-fg/80">{echo.description}</span>
                      <time dateTime={echo.timestamp} suppressHydrationWarning>
                        · {timeAgo(echo.timestamp)}
                      </time>
                    </p>
                  </li>
                ) : (
                  <li key={echo.echoId} className="relative">
                    <span
                      className={`absolute top-1.5 -left-[31px] size-3 rounded-full ring-4 ring-card ${
                        i === echoes.length - 1 ? 'bg-accent' : 'bg-muted/50'
                      }`}
                    />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                      <span className="font-semibold text-fg">{echo.reporterCodename}</span>
                      <time dateTime={echo.timestamp} className="text-muted" suppressHydrationWarning>
                        {formatTimestamp(echo.timestamp)} · {timeAgo(echo.timestamp)}
                      </time>
                      {i === 0 && <span className="text-xs text-muted">· first sighting</span>}
                    </div>
                    <p className="mt-1 text-fg">{echo.description}</p>
                  </li>
                ),
              )}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          {assignedToMe && (
            <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-fg">
              <strong>This glitch is assigned to you.</strong> Your update echoes move it forward.
            </p>
          )}
          <Card className="p-5 md:p-6">
            <WorkflowPanel glitch={glitch} defenders={defenders} guardian={guardian} />
          </Card>
          <Card className="p-5 md:p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">Add an echo</h2>
            <EchoForm
              glitchId={glitch.glitchId}
              onCreated={async (result) => {
                await router.invalidate()
                const message = outcomeMessage(result)
                if (message) notify(message, result.status === 'LEAKED' || result.status === 'ASSESSING' ? 'warning' : 'info')
              }}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatusStepper({ status, since }: { status: GlitchStatus; since: string }) {
  const current = statusIndex(status)
  const now = useNow(15_000)
  return (
    <div className="flex flex-col gap-3">
    <p className="text-sm text-muted" suppressHydrationWarning>
      In <strong className="text-fg">{status}</strong> since {formatTimestamp(since)}
      {now !== null && ` · ${timeAgo(since, now).replace(' ago', '')}`}
    </p>
    <ol className="grid grid-cols-4 gap-2">
      {GLITCH_STATUSES.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={step} className="flex flex-col gap-2">
            <span
              className={`h-1.5 rounded-full transition-colors duration-700 ${i <= current ? statusStyles[status].dot : 'bg-line'} ${
                active ? 'animate-pulse' : ''
              }`}
            />
            <span
              className={`inline-flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold uppercase sm:text-xs sm:tracking-wide ${
                active ? 'text-fg' : 'text-muted'
              }`}
            >
              {done && <Check className="size-3.5" />}
              {step}
            </span>
          </li>
        )
      })}
    </ol>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> All glitches
    </Link>
  )
}

function GlitchNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-16 text-center">
        <SearchX className="size-10 text-muted" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold text-fg">Glitch not found</h1>
        <p className="text-sm text-muted">It may have slipped through a time loop. Check the id and try again.</p>
      </div>
    </div>
  )
}
