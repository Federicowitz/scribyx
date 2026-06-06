import type { CSSProperties } from 'react';

export const UI_THEME_STORAGE_KEY = 'writex-ui-theme';

export type ThemeVars = CSSProperties & Record<`--${string}`, string>;
export type UiThemeMode = 'light' | 'shadow' | 'dark';

export const THEME_PRESETS: Record<UiThemeMode, { label: string; vars: ThemeVars }> = {
  light: {
    label: 'Chiara',
    vars: {
      '--bg': '#f2ede4',
      '--sb-bg': '#e8e2d7',
      '--sb-border': '#cfc8bb',
      '--editor-bg': '#fefdf8',
      '--surface-elevated': '#fefdf8',
      '--text': '#1c1a17',
      '--text-muted': '#7a7265',
      '--text-subtle': '#b0a898',
      '--border': '#d6cfbf',
      '--accent': '#2d5a3d',
      '--accent-hover': '#1e3f2b',
      '--accent-light': '#e6ede9',
      '--accent-2': '#7c2d12',
      '--surface-floating': '#1c1a17',
      '--todo-mark-bg': 'rgba(245, 158, 11, .18)',
      '--todo-mark-border': '#d97706',
    },
  },
  shadow: {
    label: 'Ombra',
    vars: {
      '--bg': '#ded4c4',
      '--sb-bg': '#d0c5b5',
      '--sb-border': '#b7ab9a',
      '--editor-bg': '#f5efe4',
      '--surface-elevated': '#f5efe4',
      '--text': '#201d18',
      '--text-muted': '#665d50',
      '--text-subtle': '#8d8172',
      '--border': '#bdb1a0',
      '--accent': '#2f6042',
      '--accent-hover': '#214730',
      '--accent-light': '#d7e2da',
      '--accent-2': '#7f3518',
      '--surface-floating': '#211e1a',
      '--todo-mark-bg': 'rgba(217, 119, 6, .18)',
      '--todo-mark-border': '#b45309',
    },
  },
  dark: {
    label: 'Dark',
    vars: {
      '--bg': '#171512',
      '--sb-bg': '#211d17',
      '--sb-border': '#3c342a',
      '--editor-bg': '#29241c',
      '--surface-elevated': '#29241c',
      '--text': '#f2eadc',
      '--text-muted': '#c8baa5',
      '--text-subtle': '#928674',
      '--border': '#463c30',
      '--accent': '#9fc7a7',
      '--accent-hover': '#bee0c4',
      '--accent-light': 'rgba(159, 199, 167, .16)',
      '--accent-2': '#f0a077',
      '--surface-floating': '#0f0e0c',
      '--todo-mark-bg': 'rgba(245, 158, 11, .24)',
      '--todo-mark-border': '#f59e0b',
    },
  },
};

export function readThemePreference(): UiThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
  return stored === 'shadow' || stored === 'dark' || stored === 'light' ? stored : 'light';
}
