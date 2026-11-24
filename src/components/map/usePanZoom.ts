import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

export type View = { k: number; tx: number; ty: number }

const MAX_ZOOM = 6 // relative to "fit"
const MIN_ZOOM = 0.9
const DRAG_SLOP = 5 // px before a press becomes a drag (so clicks still work)

/**
 * Pan & zoom for a W×H world inside a viewport element: wheel (around the cursor), drag,
 * two-finger pinch, buttons. Always keeps a good part of the map on screen.
 */
export function usePanZoom(viewportRef: RefObject<HTMLDivElement | null>, W: number, H: number) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ k: 0, tx: 0, ty: 0 })
  const [animating, setAnimating] = useState(false)
  const fitK = size.w && size.h ? Math.min(size.w / W, size.h / H) : 0

  const viewRef = useRef(view)
  viewRef.current = view
  const userMoved = useRef(false)
  /** True right after a drag, so the click that follows can be ignored. */
  const dragged = useRef(false)

  const clamp = useCallback(
    (v: View): View => {
      if (!fitK) return v
      const k = Math.min(fitK * MAX_ZOOM, Math.max(fitK * MIN_ZOOM, v.k))
      const axis = (t: number, viewport: number, world: number) => {
        const slack = viewport * 0.25
        const lo = world <= viewport ? (viewport - world) / 2 - slack : viewport - world - slack
        const hi = world <= viewport ? (viewport - world) / 2 + slack : slack
        return Math.min(hi, Math.max(lo, t))
      }
      return { k, tx: axis(v.tx, size.w, W * k), ty: axis(v.ty, size.h, H * k) }
    },
    [fitK, size.w, size.h, W, H],
  )

  /** Home view: whole map, except on portrait screens where it fills the height (max 2×). */
  const fitView = useCallback((): View => {
    if (!fitK) return { k: 0, tx: 0, ty: 0 }
    const portrait = size.h > size.w
    const k = portrait ? Math.min(fitK * 2, Math.max(fitK, size.h / H)) : fitK
    return { k, tx: (size.w - W * k) / 2, ty: (size.h - H * k) / 2 }
  }, [fitK, size.w, size.h, W, H])

  // Track the viewport size; keep the map fitted until the user moves it.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [viewportRef])
  useEffect(() => {
    if (!fitK) return
    setView((v) => (userMoved.current && v.k ? clamp(v) : fitView()))
  }, [fitK, clamp, fitView])

  /** Animated change (buttons, camera nudges). */
  const animateTo = useCallback(
    (next: View) => {
      setAnimating(true)
      setView(clamp(next))
      window.setTimeout(() => setAnimating(false), 420)
    },
    [clamp],
  )

  const zoomAround = useCallback(
    (factor: number, sx: number, sy: number, animate = false) => {
      const v = viewRef.current
      const k = Math.min(fitK * MAX_ZOOM, Math.max(fitK * MIN_ZOOM, v.k * factor))
      const wx = (sx - v.tx) / v.k
      const wy = (sy - v.ty) / v.k
      const next = { k, tx: sx - wx * k, ty: sy - wy * k }
      userMoved.current = true
      if (animate) animateTo(next)
      else setView(clamp(next))
    },
    [fitK, clamp, animateTo],
  )

  const zoomBy = (factor: number) => zoomAround(factor, size.w / 2, size.h / 2, true)
  const reset = () => {
    userMoved.current = false
    animateTo(fitView())
  }
  /** Move the camera so world point (x, y) is a bit closer to the centre (or centred, with fraction 1). */
  const nudgeTo = (x: number, y: number, fraction = 0.25) => {
    const v = viewRef.current
    const sx = v.tx + x * v.k
    const sy = v.ty + y * v.k
    animateTo({ k: v.k, tx: v.tx + (size.w / 2 - sx) * fraction, ty: v.ty + (size.h / 2 - sy) * fraction })
  }

  // Wheel needs a non-passive listener to prevent page zoom/scroll.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAround(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [viewportRef, zoomAround])

  // Pointer handling: one pointer drags, two pointers pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ start: { x: number; y: number }; view: View; dist?: number; mid?: { x: number; y: number }; moved: boolean } | null>(null)

  const local = (e: ReactPointerEvent) => {
    const rect = viewportRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const beginGesture = () => {
    const pts = [...pointers.current.values()]
    const v = viewRef.current
    if (pts.length === 1) {
      gesture.current = { start: pts[0], view: v, moved: gesture.current?.moved ?? false }
    } else if (pts.length >= 2) {
      const [a, b] = pts
      gesture.current = {
        start: a,
        view: v,
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        moved: true,
      }
    }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    pointers.current.set(e.pointerId, local(e))
    dragged.current = false
    beginGesture()
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, local(e))
    const g = gesture.current
    const pts = [...pointers.current.values()]
    if (pts.length >= 2 && g.dist && g.mid) {
      const [a, b] = pts
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const k = Math.min(fitK * MAX_ZOOM, Math.max(fitK * MIN_ZOOM, g.view.k * (dist / g.dist)))
      const wx = (g.mid.x - g.view.tx) / g.view.k
      const wy = (g.mid.y - g.view.ty) / g.view.k
      userMoved.current = true
      dragged.current = true
      setView(clamp({ k, tx: mid.x - wx * k, ty: mid.y - wy * k }))
      return
    }
    const p = pts[0]
    const dx = p.x - g.start.x
    const dy = p.y - g.start.y
    if (!g.moved && Math.hypot(dx, dy) < DRAG_SLOP) return
    if (!g.moved) {
      g.moved = true
      // Capture only once it's really a drag, so clicks on markers keep working.
      viewportRef.current?.setPointerCapture(e.pointerId)
    }
    userMoved.current = true
    dragged.current = true
    setView(clamp({ k: g.view.k, tx: g.view.tx + dx, ty: g.view.ty + dy }))
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) gesture.current = null
    else beginGesture()
  }

  return {
    view,
    fitK,
    zoom: fitK ? view.k / fitK : 1,
    animating,
    dragged,
    zoomBy,
    reset,
    nudgeTo,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}
