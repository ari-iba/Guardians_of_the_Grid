import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, MessageSquareText, UserRound } from 'lucide-react'
import { StatusBadge } from '#/components/ui/StatusBadge.tsx'
import { formatTimestamp } from '#/lib/format.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'

const columns = ['ID', 'Status', 'Description', 'Echoes', 'Assigned', 'Reported', '']

type GlitchesTableProps = {
  glitches: GlitchSummary[]
  /** Keyboard-selected row (j/k). */
  selectedId?: string | null
  /** Rows that just appeared through live updates. */
  freshIds?: ReadonlySet<string>
}

export function GlitchesTable({ glitches, selectedId, freshIds }: GlitchesTableProps) {
  const navigate = useNavigate()
  const open = (glitchId: string) => navigate({ to: '/glitches/$glitchId', params: { glitchId } })

  return (
    <section>
      {/* Phones: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {glitches.map((glitch) => (
          <li key={glitch.glitchId}>
            <Link
              to="/glitches/$glitchId"
              params={{ glitchId: glitch.glitchId }}
              data-glitch-row={glitch.glitchId}
              className={`flex flex-col gap-2 rounded-2xl border bg-card p-4 transition ${
                selectedId === glitch.glitchId ? 'border-accent ring-2 ring-accent/30' : 'border-line'
              } ${freshIds?.has(glitch.glitchId) ? 'fresh-row' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-fg">{glitch.glitchId}</span>
                <StatusBadge status={glitch.status} />
              </div>
              <p className="text-fg">{glitch.description}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <MessageSquareText className="size-3.5" /> {glitch.echoCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3.5" /> {glitch.assignedCodename ?? 'Unassigned'}
                </span>
                <time dateTime={glitch.timestamp} suppressHydrationWarning>
                  {formatTimestamp(glitch.timestamp)}
                </time>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablets and up: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b-2 border-line text-sm text-muted">
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 font-normal">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-fg">
            {glitches.map((glitch) => {
              const selected = selectedId === glitch.glitchId
              return (
                <tr
                  key={glitch.glitchId}
                  data-glitch-row={glitch.glitchId}
                  onClick={() => open(glitch.glitchId)}
                  aria-selected={selected}
                  className={`group cursor-pointer border-b border-line transition-colors hover:bg-subtle ${
                    selected ? 'bg-subtle outline-2 -outline-offset-2 outline-accent' : ''
                  } ${freshIds?.has(glitch.glitchId) ? 'fresh-row' : ''}`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Link
                      to="/glitches/$glitchId"
                      params={{ glitchId: glitch.glitchId }}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-sm font-semibold hover:text-accent"
                    >
                      {glitch.glitchId}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={glitch.status} />
                  </td>
                  <td className="px-4 py-4">{glitch.description}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquareText className="size-4" />
                      {glitch.echoCount}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {glitch.assignedCodename ? (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="size-4 text-muted" />
                        {glitch.assignedCodename}
                      </span>
                    ) : (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-muted">
                    {/* Server and browser time zones can differ; the browser's wins. */}
                    <time dateTime={glitch.timestamp} suppressHydrationWarning>
                      {formatTimestamp(glitch.timestamp)}
                    </time>
                  </td>
                  <td className="px-2 py-4 text-muted">
                    <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
