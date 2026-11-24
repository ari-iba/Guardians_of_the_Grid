export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'gotg-theme'

/**
 * Inline in <head> so the right theme is set before first paint (no flash).
 * Stored choice wins, else the OS preference. Storage can throw (private mode), hence try/catch.
 */
export const themeInitScript = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(t!=='dark'&&t!=='light'){try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){t='light'}}d.dataset.theme=t})()`

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}
