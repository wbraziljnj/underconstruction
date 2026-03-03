const THEME_KEY = 'uc_theme';

export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme() {
  applyTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
}

