/**
 * Monster-specific color palettes.
 * These layer on top of the base light/dark theme and provide
 * accent colors that reflect the user's chosen monster.
 */

export interface MonsterPalette {
  /** Primary action/accent color */
  accent: string;
  /** Soft background tint (light mode surfaces) */
  accentLight: string;
  /** Dark-mode accent background */
  accentDark: string;
  /** Text color used on accent-tinted backgrounds */
  text: string;
  /** Active tab icon tint */
  tabTint: string;
  /** Which monster this palette belongs to */
  monster: 'nilly' | 'luna';
}

export const NILLY_PALETTE: MonsterPalette = {
  accent: '#52b788',
  accentLight: '#b8f5c8',
  accentDark: '#1a4d2e',
  text: '#1a5c3a',
  tabTint: '#52b788',
  monster: 'nilly',
};

export const LUNA_PALETTE: MonsterPalette = {
  accent: '#cc2222',
  accentLight: '#2a0a2a',
  accentDark: '#1a0a1a',
  text: '#f0e0e0',
  tabTint: '#cc2222',
  monster: 'luna',
};

/** Fallback palette used before monster selection (defaults to Nilly) */
export const DEFAULT_PALETTE: MonsterPalette = NILLY_PALETTE;
