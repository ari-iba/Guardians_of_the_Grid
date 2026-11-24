import { useEffect } from 'react'
import { GAUGE_ID } from '#/components/MagicGauge.tsx'
import { useAppUi, type Repair } from '#/lib/app-ui.ts'

const PARTICLES = 18
const SPARKS = 14

function visibleRect(selector: string): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (el.offsetParent === null && !(el instanceof SVGElement)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width && rect.bottom > 0 && rect.top < window.innerHeight) return rect
  }
  return null
}

function spawn(className: string, x: number, y: number, text?: string): HTMLElement {
  const el = document.createElement('span')
  el.className = className
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  if (text) el.textContent = text
  document.body.appendChild(el)
  return el
}

/** Particles from the repaired glitch's row (or marker) into the gauge, then a sparkle burst. */
function playRepair({ glitchId, district }: Repair, index: number) {
  const gauge = document.getElementById(GAUGE_ID)?.getBoundingClientRect()
  if (!gauge) return
  const tx = gauge.left + gauge.width / 2
  const ty = gauge.top + gauge.height * 0.7
  const source =
    visibleRect(`[data-glitch-row="${glitchId}"]`) ??
    visibleRect(`[data-glitch-marker="${glitchId}"]`) ??
    visibleRect(`[data-district-island="${district}"]`) ??
    new DOMRect(window.innerWidth / 2 - 50, window.innerHeight - 60, 100, 20)
  const delay = index * 250

  for (let i = 0; i < PARTICLES; i++) {
    const sx = source.left + Math.random() * source.width
    const sy = source.top + source.height / 2 + (Math.random() - 0.5) * source.height
    const dx = tx - sx
    const dy = ty - sy
    const el = spawn('repair-particle', sx, sy)
    el.animate(
      [
        { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
        { transform: 'translate(0, 0) scale(1.2)', opacity: 1, offset: 0.12 },
        {
          transform: `translate(${dx * 0.45 + (Math.random() - 0.5) * 160}px, ${dy * 0.5 - 60 - Math.random() * 80}px) scale(1)`,
          opacity: 1,
          offset: 0.55,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.9 },
      ],
      { duration: 850 + Math.random() * 300, delay: delay + i * 22, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'backwards' },
    ).onfinish = () => el.remove()
  }

  setTimeout(() => {
    for (let i = 0; i < SPARKS; i++) {
      const angle = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.4
      const distance = 40 + Math.random() * 55
      const el = spawn('repair-spark', tx, ty, i % 3 === 0 ? '✦' : '✧')
      el.style.color = i % 2 ? '#34d399' : '#fbbf24'
      el.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(1.1) rotate(160deg)`,
            opacity: 0,
          },
        ],
        { duration: 750 + Math.random() * 250, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      ).onfinish = () => el.remove()
    }
  }, delay + 1050)
}

/** Plays the repair animation for glitches that just became FIXED (queued by the layout). */
export function RepairParticles() {
  const { repairs, clearRepairs } = useAppUi()

  useEffect(() => {
    if (repairs.length === 0) return
    const batch = [...repairs]
    clearRepairs(batch.map((r) => r.glitchId))
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // Next frame: let the table/gauge render the new data first.
    requestAnimationFrame(() => batch.forEach((repair, i) => playRepair(repair, i)))
  }, [repairs, clearRepairs])

  return null
}
