import type { GlitchStatus } from '#/lib/glitch.ts'

export const statusStyles: Record<GlitchStatus, { badge: string; dot: string; label: string }> = {
  LEAKED: {
    label: 'Leaked',
    badge: 'bg-red-500/12 text-red-700 ring-red-500/30 dark:text-red-300',
    dot: 'bg-red-500',
  },
  ASSESSING: {
    label: 'Assessing',
    badge: 'bg-orange-500/12 text-orange-700 ring-orange-500/30 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  CONTAINING: {
    label: 'Containing',
    badge: 'bg-blue-500/12 text-blue-700 ring-blue-500/30 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  FIXED: {
    label: 'Fixed',
    badge: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
}

/** Same colours as the badges, for SVG fills. */
export const STATUS_HEX: Record<GlitchStatus, string> = {
  LEAKED: '#ef4444',
  ASSESSING: '#f97316',
  CONTAINING: '#3b82f6',
  FIXED: '#10b981',
}

export function StatusBadge({ status }: { status: GlitchStatus }) {
  const style = statusStyles[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide whitespace-nowrap uppercase ring-1 ${style.badge}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot} ${status === 'LEAKED' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  )
}
