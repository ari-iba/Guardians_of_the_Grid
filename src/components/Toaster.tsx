import { useCallback, useRef, useState } from 'react'
import { CircleCheck, Info, Sparkles, TriangleAlert, X } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'magic'
export type Toast = { id: number; message: string; tone: ToastTone }

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: 'border-accent/40 text-fg' },
  success: { icon: CircleCheck, className: 'border-emerald-500/50 text-fg' },
  warning: { icon: TriangleAlert, className: 'border-orange-500/50 text-fg' },
  danger: { icon: TriangleAlert, className: 'border-red-500/60 text-fg' },
  magic: { icon: Sparkles, className: 'border-emerald-400/60 text-fg' },
}

const iconColor: Record<ToastTone, string> = {
  info: 'text-accent',
  success: 'text-emerald-500',
  warning: 'text-orange-500',
  danger: 'text-red-500',
  magic: 'text-emerald-400',
}

/** Small toast queue. Returns [toasts, notify, dismiss]. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, message, tone }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )
  return [toasts, notify, dismiss] as const
}

export function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => {
        const { icon: Icon, className } = toneStyles[toast.tone]
        return (
          <div
            key={toast.id}
            role="status"
            className={`toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border bg-card/95 px-4 py-3 text-sm shadow-xl backdrop-blur ${className}`}
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor[toast.tone]}`} />
            <span className="flex-1">{toast.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => onDismiss(toast.id)} className="text-muted hover:text-fg">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
