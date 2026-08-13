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
  monster: "nilly" | "luna";

  /** Full-screen page background (Tasks / later shared chrome) */
  page: string;
  /** Default task / list card */
  surface: string;
  /** Elevated card (reward-ready, carried rewards) */
  surfaceRaised: string;
  /** Primary body / task name */
  ink: string;
  /** Secondary labels, hints, progress */
  inkMuted: string;
  /** Hairline edge (not a generic gray stroke) */
  line: string;
  /** Text on solid accent buttons */
  accentInk: string;
  /** Soft accent wash (badges, celebration, breakdown) */
  accentSoft: string;
  /** Text on accentSoft surfaces */
  onSoft: string;
}

export const NILLY_PALETTE: MonsterPalette = {
  accent: "#52b788",
  accentLight: "#b8f5c8",
  accentDark: "#1a4d2e",
  text: "#1a5c3a",
  tabTint: "#52b788",
  monster: "nilly",

  page: "#eef8f2",
  surface: "#f7fdf9",
  surfaceRaised: "#ffffff",
  ink: "#1e3a2f",
  inkMuted: "#5a7266",
  line: "rgba(30,58,47,0.08)",
  accentInk: "#ffffff",
  accentSoft: "#b8f5c8",
  onSoft: "#1a5c3a",
};

export const LUNA_PALETTE: MonsterPalette = {
  accent: "#cc2222",
  accentLight: "#2a0a2a",
  accentDark: "#1a0a1a",
  text: "#f0e0e0",
  tabTint: "#cc2222",
  monster: "luna",

  page: "#14121c",
  surface: "#1c1826",
  surfaceRaised: "#261c2e",
  ink: "#f0e6d3",
  inkMuted: "#9a8fa0",
  line: "rgba(240,230,211,0.10)",
  accentInk: "#f0e6d3",
  accentSoft: "#3a1220",
  onSoft: "#f0e0e0",
};

/** Fallback palette used before monster selection (defaults to Nilly) */
export const DEFAULT_PALETTE: MonsterPalette = NILLY_PALETTE;
