import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { MapPin, MessageSquareText } from 'lucide-react'
import { HpBar } from '#/components/game/HpBar.tsx'
import { MonsterSprite } from '#/components/game/MonsterSprite.tsx'
import { StatusBadge } from '#/components/ui/StatusBadge.tsx'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'
import { HP_BY_STATUS, WILD_SPAWN_TOOLTIP, monsterName, monsterTraits } from '#/lib/monster.ts'
import { playHit } from '#/lib/sound.ts'

export type DeployTarget = {
  /** A defender is being dragged (or picked) and may be dropped here. */
  armed: boolean
  onDeploy: (glitchId: string, guardianId: string) => void
}

/** Initials avatar, also used by the HUD and the deploy bench. */
export function Avatar({ codename, className = '' }: { codename: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-accent-from to-accent-to font-pixel text-white uppercase shadow-sm ring-2 ring-black/20 ${className}`}
    >
      {codename.slice(0, 2)}
    </span>
  )
}

/** One glitch as a monster: generated creature, name, HP bar and status. */
export function MonsterCard({
  glitch,
  selected = false,
  fresh = false,
  boss = false,
  deploy,
  deployed = false,
  pickedGuardianId,
}: {
  glitch: GlitchSummary
  selected?: boolean
  fresh?: boolean
  boss?: boolean
  deploy?: DeployTarget
  /** Just received a defender: plays the deploy animation. */
  deployed?: boolean
  /** Tap-to-deploy: the defender picked on the bench (touch / keyboard alternative to dragging). */
  pickedGuardianId?: string | null
}) {
  const name = monsterName(glitch)
  const hit = useHit(glitch.status)
  const defeated = glitch.status === 'FIXED'
  const [dragOver, setDragOver] = useState(false)
  const canDeploy = !!deploy && !defeated

  const onDrop = (e: DragEvent) => {
    if (!canDeploy) return
    e.preventDefault()
    setDragOver(false)
    const guardianId = e.dataTransfer.getData('application/x-guardian')
    if (guardianId) deploy.onDeploy(glitch.glitchId, guardianId)
  }

  return (
    <Link
      to="/glitches/$glitchId"
      params={{ glitchId: glitch.glitchId }}
      data-glitch-row={glitch.glitchId}
      onClick={(e) => {
        // Tap-to-deploy: with a defender picked, tapping a monster deploys instead of opening it.
        if (canDeploy && pickedGuardianId) {
          e.preventDefault()
          deploy.onDeploy(glitch.glitchId, pickedGuardianId)
        }
      }}
      onDragOver={(e) => {
        if (!canDeploy || !e.dataTransfer.types.includes('application/x-guardian')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`monster-card group relative flex flex-col gap-3 rounded-2xl p-4 transition ${
        glitch.source === 'auto' ? 'wild-spawn' : 'glass'
      } ${boss ? 'boss-card' : ''} ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-app' : ''} ${
        canDeploy && (deploy.armed || pickedGuardianId) ? 'deploy-armed' : ''
      } ${dragOver ? 'deploy-over' : ''} ${defeated ? 'opacity-80' : 'hover:-translate-y-0.5'}`}
    >
      {glitch.source === 'auto' && (
        <span
          title={WILD_SPAWN_TOOLTIP}
          className="absolute -top-2.5 left-4 z-10 cursor-help rounded-md bg-neon-gold px-1.5 py-1 font-pixel text-[8px] text-black shadow"
        >
          🤖 WILD SPAWN
        </span>
      )}
      {boss && (
        <span
          title="Boss = the biggest open glitch during a lockdown"
          className="absolute -top-2.5 right-4 z-10 cursor-help rounded-md bg-red-600 px-1.5 py-1 font-pixel text-[8px] text-white shadow"
        >
          BOSS
        </span>
      )}

      <div className="arena relative flex h-28 items-end justify-center overflow-visible rounded-xl">
        {defeated && !hit ? (
          <div className="flex h-full flex-col items-center justify-center gap-1" title="Defeated = Status: FIXED">
            <MonsterSprite glitch={glitch} className="h-14 w-14 opacity-25 grayscale" title={`${name} (defeated)`} />
            <span className="font-pixel text-[9px] text-emerald-500">CLEARED</span>
          </div>
        ) : (
          <div
            key={hit?.key ?? 'idle'}
            className={`relative h-24 w-24 ${fresh ? 'monster-spawn' : ''} ${
              hit ? (defeated ? 'monster-vaporize' : hit.delta < 0 ? 'monster-hit' : 'monster-heal') : 'monster-idle'
            }`}
          >
            <MonsterSprite glitch={glitch} className="h-full w-full" title={name} />
          </div>
        )}
        {hit && hit.delta !== 0 && (
          <span
            key={`dmg-${hit.key}`}
            className={`dmg-float pointer-events-none absolute top-2 font-pixel text-sm ${hit.delta < 0 ? 'text-red-500' : 'text-emerald-500'}`}
          >
            {hit.delta > 0 ? '+' : ''}
            {hit.delta} HP
          </span>
        )}
        {hit && defeated && <PixelBurst key={`burst-${hit.key}`} glitch={glitch} />}
        {deployed && (
          <span className="deploy-stamp pointer-events-none absolute inset-x-0 top-1/3 text-center font-pixel text-xs text-neon-cyan">
            DEPLOYED!
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-semibold text-fg">{name}</h3>
          <span className="shrink-0 font-mono text-xs text-muted">{glitch.glitchId}</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{glitch.description}</p>
      </div>

      <HpBar status={glitch.status} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        <StatusBadge status={glitch.status} />
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" /> {DISTRICT_LABELS[glitch.district]}
        </span>
        <span className="inline-flex items-center gap-1" title={`${glitch.echoCount} echoes (reports)`}>
          <MessageSquareText className="size-3.5" /> {glitch.echoCount}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5" title={glitch.assignedCodename ? `Assigned to ${glitch.assignedCodename}` : 'No defender assigned'}>
          {glitch.assignedCodename ? (
            <>
              <Avatar codename={glitch.assignedCodename} className="size-5 text-[7px]" />
              <span className="text-fg">{glitch.assignedCodename}</span>
            </>
          ) : (
            'Unassigned'
          )}
        </span>
      </div>
    </Link>
  )
}

/** Remembers the previous status; returns a fresh "hit" for a short while after each change. */
function useHit(status: GlitchSummary['status']) {
  const previous = useRef(status)
  const [hit, setHit] = useState<{ key: number; delta: number } | null>(null)
  useEffect(() => {
    if (previous.current === status) return
    const delta = HP_BY_STATUS[status] - HP_BY_STATUS[previous.current]
    previous.current = status
    setHit({ key: Date.now(), delta })
    if (delta < 0) playHit()
    const id = setTimeout(() => setHit(null), 1500)
    return () => clearTimeout(id)
  }, [status])
  return hit
}

/** The monster dissolving into pixels when it is defeated. */
function PixelBurst({ glitch }: { glitch: GlitchSummary }) {
  const bits = useMemo(() => {
    const { hue } = monsterTraits(glitch)
    return Array.from({ length: 22 }, (_, i) => {
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.5
      const dist = 30 + Math.random() * 45
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 20,
        color: i % 4 === 0 ? '#fff' : `hsl(${hue + (Math.random() - 0.5) * 30} 80% 60%)`,
        delay: Math.random() * 180,
      }
    })
  }, [glitch])
  return (
    <span aria-hidden className="pointer-events-none absolute bottom-12 left-1/2">
      {bits.map((b, i) => (
        <span
          key={i}
          className="pixel-bit"
          style={{ '--dx': `${b.dx}px`, '--dy': `${b.dy}px`, background: b.color, animationDelay: `${b.delay}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  )
}
