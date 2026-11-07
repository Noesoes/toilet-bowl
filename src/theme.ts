import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource/graduate/latin-400.css';
import '@fontsource/russo-one/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';

export type ThemeId = 'stadium' | 'varsity' | 'neon' | 'porcelain';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  tagline: string;
  /** bg, surface, accent, secondary — used for the picker preview */
  swatches: [string, string, string, string];
  /** Browser / iOS status-bar color */
  meta: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'varsity', name: 'Varsity', tagline: 'Old-school letterman jacket', swatches: ['#f2e8d2', '#fffaf0', '#c8102e', '#1d2a44'], meta: '#1d2a44' },
  { id: 'stadium', name: 'Stadium Lights', tagline: 'Prime-time under the lights', swatches: ['#060a13', '#111a2c', '#b6ff3b', '#38bdf8'], meta: '#060a13' },
  { id: 'neon', name: 'Neon Blitz', tagline: 'Arcade mode, all gas', swatches: ['#0b0420', '#170a35', '#ff2fd6', '#00f0ff'], meta: '#0b0420' },
  { id: 'porcelain', name: 'Royal Flush', tagline: 'Gleaming porcelain & gold', swatches: ['#e6f4fb', '#ffffff', '#1e6bff', '#d9a520'], meta: '#e6f4fb' },
];

const KEY = 'toilet-bowl:theme:v2';
export const DEFAULT_THEME: ThemeId = 'varsity';

export function loadTheme(): ThemeId {
  try {
    const t = localStorage.getItem(KEY) as ThemeId | null;
    if (t && THEMES.some((x) => x.id === t)) return t;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THEME;
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', THEMES.find((t) => t.id === id)!.meta);
}

/** Remember an explicit choice (not saved until the user picks one, so the default can change). */
export function saveTheme(id: ThemeId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
}
