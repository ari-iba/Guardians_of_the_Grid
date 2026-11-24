import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, currentTheme, type Theme } from '#/lib/theme.ts'

/** Toggles <html data-theme>. Initial value is read after mount so SSR markup stays stable. */
export function useTheme(): [Theme | null, () => void] {
  const [theme, setTheme] = useState<Theme | null>(null)
  useEffect(() => setTheme(currentTheme()), [])
  const toggle = () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }
  return [theme, toggle]
}

export function ThemeToggle({ theme, onToggle, className = '' }: { theme: Theme | null; onToggle: () => void; className?: string }) {
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button type="button" onClick={onToggle} aria-label={label} title={`${label} (t)`} className={className}>
      {theme === 'dark' ? <Sun className="size-5" strokeWidth={1.75} /> : <Moon className="size-5" strokeWidth={1.75} />}
    </button>
  )
}
