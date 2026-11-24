import { STATUS_HEX } from '#/components/ui/StatusBadge.tsx'
import type { GlitchStatus } from '#/lib/glitch.ts'
import { HP_BY_STATUS, hpTooltip } from '#/lib/monster.ts'

/** Segmented arcade HP bar. Hover (or a screen reader) tells what it really means. */
export function HpBar({ status, size = 'md', label = true }: { status: GlitchStatus; size?: 'md' | 'lg'; label?: boolean }) {
  const hp = HP_BY_STATUS[status]
  const tip = hpTooltip(status)
  return (
    <div className="flex items-center gap-2" title={tip}>
      {label && <span className="font-pixel text-[9px] text-muted">HP</span>}
      <div
        role="meter"
        aria-label={tip}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hp}
        className={`hp-bar relative flex-1 cursor-help overflow-hidden rounded-sm border-2 border-black/50 bg-black/30 ${size === 'lg' ? 'h-5' : 'h-3'}`}
      >
        <div
          className="hp-fill h-full"
          style={{ width: `${hp}%`, background: STATUS_HEX[status], boxShadow: `0 0 10px ${STATUS_HEX[status]}` }}
        />
      </div>
      {label && <span className="w-8 text-right font-pixel text-[9px] text-fg tabular-nums">{hp}</span>}
    </div>
  )
}
