import { Link, createFileRoute, getRouteApi, notFound } from '@tanstack/react-router'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Avatar } from '#/components/game/MonsterCard.tsx'
import { LevelBadge, XpBar } from '#/components/game/XpBar.tsx'
import { Card } from '#/components/ui/Card.tsx'
import { RoleBadge } from '#/components/ui/RoleBadge.tsx'
import { useNow } from '#/lib/app-ui.ts'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import { timeAgo } from '#/lib/format.ts'
import { BADGES, getLeaderboard } from '#/lib/leaderboard.functions.ts'
import { ACHIEVEMENTS, type AchievementId, type XpReason } from '#/lib/progress.ts'

const appRoute = getRouteApi('/_app')

export const Route = createFileRoute('/_app/guardians/$guardianId')({
  loader: async ({ params }) => {
    if (!/^[A-Za-z0-9-]{1,32}$/.test(params.guardianId)) throw notFound()
    return { leaderboard: await getLeaderboard() }
  },
  head: () => ({ meta: [{ title: 'Character card · Control Center' }] }),
  component: ProfilePage,
  notFoundComponent: ProfileNotFound,
})

const REASON_ICON: Record<XpReason, string> = {
  echo: '📣',
  assigned: '🎯',
  contain: '🧪',
  fix: '⚔️',
  'wild-fix': '🤖',
  quest: '📜',
}

function ProfilePage() {
  const { guardianId } = Route.useParams()
  const { leaderboard } = Route.useLoaderData()
  const { players } = appRoute.useLoaderData()
  const { guardian } = appRoute.useRouteContext()
  const now = useNow(30_000)
  const player = players.find((p) => p.guardianId === guardianId)
  if (!player) return <ProfileNotFound />

  const badges = leaderboard.find((e) => e.guardianId === guardianId)?.badges ?? []
  const unlocked = new Map(player.achievements.map((a) => [a.id, a.unlockedAt]))
  const isMe = guardian.guardianId === guardianId
  const s = player.stats

  const stats: { label: string; value: string; hint: string }[] = [
    { label: 'Fixed', value: String(s.fixed), hint: 'Glitches this guardian brought to FIXED' },
    { label: 'Echoes', value: String(s.echoes), hint: 'Echoes (reports) this guardian posted' },
    { label: 'Fastest fix', value: s.fastestFixMinutes === null ? '–' : `${s.fastestFixMinutes}m`, hint: 'Fastest time from first report to FIXED' },
    { label: 'Contained', value: String(s.contained), hint: 'Glitches moved to CONTAINING' },
    { label: 'Wild spawns', value: String(s.wildFixed), hint: 'Auto-detected glitches (🤖) fixed' },
    ...(player.role === 'commander' ? [{ label: 'Deployed', value: String(s.deployed), hint: 'Defenders assigned to a glitch' }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <Link to="/leaderboard" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Highscores
      </Link>

      <Card className="relative overflow-hidden p-5 md:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <Avatar codename={player.codename} className="size-24 self-center rounded-2xl text-2xl md:self-auto" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="font-pixel text-[10px] text-accent">Character card{isMe && ' · you'}</p>
            <h1 className="title-pixel flex flex-wrap items-center gap-3 text-xl text-fg md:text-2xl">
              {player.codename}
              <RoleBadge role={player.role} />
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <LevelBadge player={player} className="text-[11px]" />
              <span className="font-pixel text-[10px] text-neon-gold">{player.title}</span>
              <span className="font-pixel text-[10px] text-muted tabular-nums">{player.xp} XP total</span>
            </div>
            <XpBar player={player} className="max-w-md" />
          </div>
        </div>
      </Card>

      <section aria-label="Stats" className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {stats.map((st) => (
          <div key={st.label} title={st.hint} className="glass cursor-help rounded-2xl px-4 py-3">
            <p className="text-xs text-muted">{st.label}</p>
            <p className="font-pixel text-lg text-fg tabular-nums">{st.value}</p>
          </div>
        ))}
        <div title="District with the most activity" className="glass col-span-full cursor-help rounded-2xl px-4 py-3">
          <p className="text-xs text-muted">Favourite district</p>
          <p className="font-semibold text-fg">{s.favoriteDistrict ? DISTRICT_LABELS[s.favoriteDistrict] : '–'}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 md:p-6">
          <h2 className="title-pixel mb-4 text-xs text-muted">Badges & achievements</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(ACHIEVEMENTS) as AchievementId[]).map((id) => {
              const a = ACHIEVEMENTS[id]
              const at = unlocked.get(id)
              return (
                <li key={id} title={a.description} className={`flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2 ${at ? '' : 'opacity-45'}`}>
                  <span className={`text-2xl ${at ? '' : 'grayscale'}`} aria-hidden>
                    {a.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-fg">{a.label}</span>
                    <span className="text-xs text-muted" suppressHydrationWarning>
                      {at ? `Unlocked ${now !== null ? timeAgo(at, now) : ''}` : 'Locked'}
                    </span>
                  </span>
                </li>
              )
            })}
            {badges.map((id) => (
              <li key={id} title={BADGES[id].description} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2">
                <span className="text-2xl" aria-hidden>
                  {BADGES[id].emoji}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-fg">{BADGES[id].label}</span>
                  <span className="text-xs text-muted">{BADGES[id].description}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="title-pixel mb-4 text-xs text-muted">Recent activity</h2>
          {player.recent.length === 0 ? (
            <p className="text-sm text-muted">No XP earned yet. Report an echo to get started.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line">
              {player.recent.map((e, i) => (
                <li key={`${e.timestamp}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                  <span aria-hidden>{REASON_ICON[e.reason]}</span>
                  <span className="min-w-0 flex-1 text-fg">
                    {e.label}
                    {e.glitchId && (
                      <Link to="/glitches/$glitchId" params={{ glitchId: e.glitchId }} className="ml-1.5 font-mono text-xs text-accent hover:underline">
                        {e.glitchId}
                      </Link>
                    )}
                  </span>
                  <time dateTime={e.timestamp} className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                    {now !== null ? timeAgo(e.timestamp, now) : ''}
                  </time>
                  <span className="w-16 shrink-0 text-right font-pixel text-[9px] text-neon-gold">+{e.xp} XP</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}

function ProfileNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-16 text-center">
      <SearchX className="size-10 text-muted" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold text-fg">Guardian not found</h1>
      <Link to="/leaderboard" className="text-sm font-semibold text-accent hover:underline">
        Back to the highscores
      </Link>
    </div>
  )
}
