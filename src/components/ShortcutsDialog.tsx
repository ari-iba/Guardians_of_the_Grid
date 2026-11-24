import { useEffect, useRef } from 'react'
import { Keyboard, X } from 'lucide-react'
import { IconButton } from '#/components/ui/IconButton.tsx'
import { SHORTCUTS } from '#/lib/hotkeys.ts'

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="shortcuts-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-card p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 id="shortcuts-title" className="inline-flex items-center gap-2 text-xl font-semibold">
            <Keyboard className="size-5 text-accent" /> Keyboard shortcuts
          </h2>
          <IconButton aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-subtle">
            <X className="size-5" />
          </IconButton>
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {SHORTCUTS.map(({ keys, description }) => (
            <li key={description} className="flex items-center justify-between py-2.5 text-sm">
              <span>{description}</span>
              <span className="flex gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-7 rounded-md border border-line border-b-2 bg-subtle px-2 py-0.5 text-center font-mono text-xs font-semibold"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Shortcuts are paused while you type in a field.</p>
      </div>
    </dialog>
  )
}
