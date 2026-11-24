import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import { StatusBadge } from '#/components/ui/StatusBadge.tsx'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'

export type Command = {
  id: string
  label: string
  icon: ReactNode
  /** Extra words that should match (e.g. "dark light" for the theme toggle). */
  keywords?: string
  shortcut?: string
  run: () => void
}

type Item = { id: string; group: 'Actions' | 'Glitches'; label: ReactNode; text: string; icon?: ReactNode; shortcut?: string; run: () => void }

/** Ctrl+K / ⌘K palette: actions and glitches, filtered as you type, keyboard first. */
export function CommandPalette({
  open,
  onClose,
  commands,
  glitches,
  onOpenGlitch,
}: {
  open: boolean
  onClose: () => void
  commands: Command[]
  glitches: GlitchSummary[]
  onOpenGlitch: (glitchId: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setQuery('')
      setActive(0)
      dialog.showModal()
      inputRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const matches = (text: string) => words.every((w) => text.includes(w))
    const actions: Item[] = commands
      .filter((c) => matches(`${c.label} ${c.keywords ?? ''}`.toLowerCase()))
      .map((c) => ({ id: c.id, group: 'Actions', label: c.label, text: c.label, icon: c.icon, shortcut: c.shortcut, run: c.run }))
    const pool = words.length ? glitches : glitches.filter((g) => g.status !== 'FIXED')
    const found: Item[] = pool
      .filter((g) => matches(`${g.glitchId} ${g.description} ${DISTRICT_LABELS[g.district]} ${g.status}`.toLowerCase()))
      .slice(0, 8)
      .map((g) => ({
        id: g.glitchId,
        group: 'Glitches',
        text: `${g.glitchId} ${g.description}`,
        label: (
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted">{g.glitchId}</span>
            <span className="truncate">{g.description}</span>
            <span className="ml-auto shrink-0">
              <StatusBadge status={g.status} />
            </span>
          </span>
        ),
        run: () => onOpenGlitch(g.glitchId),
      }))
    return [...actions, ...found]
  }, [query, commands, glitches, onOpenGlitch])

  useEffect(() => setActive(0), [query])

  // Keep the highlighted item in view.
  useEffect(() => {
    dialogRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(item: Item | undefined) {
    if (!item) return
    onClose()
    item.run()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Command palette"
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-line bg-card p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-5 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(items.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(items[active])
            }
          }}
          placeholder="Type a command or search glitches…"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
          className="h-14 flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
        />
        <kbd className="rounded border border-line px-1.5 font-mono text-xs text-muted">Esc</kbd>
      </div>
      <ul id="command-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
        {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing found.</li>}
        {items.map((item, i) => (
          <li key={item.group + item.id}>
            {(i === 0 || items[i - 1].group !== item.group) && (
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{item.group}</p>
            )}
            <button
              type="button"
              id={`cmd-${item.id}`}
              role="option"
              aria-selected={i === active}
              data-index={i}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(item)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                i === active ? 'bg-accent/12 text-fg' : 'text-fg hover:bg-subtle'
              }`}
            >
              {item.icon && <span className="text-muted">{item.icon}</span>}
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.shortcut && <kbd className="rounded border border-line px-1.5 font-mono text-xs text-muted">{item.shortcut}</kbd>}
              {i === active && <CornerDownLeft className="size-4 shrink-0 text-muted" />}
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  )
}
