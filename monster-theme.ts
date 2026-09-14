/**
 * Monster-specific color palettes.
 * These layer on top of the base light/dark theme and provide
 * accent colors that reflect the user's chosen monster.
 *
 * Accent hexes are part of the product contract (tests lock them).
 * Page / surface / atmosphere tokens are the shared presentation layer —
 * Home, Collection, Store, and Tasks should read these instead of
 * inventing a parallel palette.
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

  /** Habitat particle / secondary glow */
  particle: string;
  /** Stat bar track */
  barTrack: string;
  /** Bottom sheet on Home */
  panelBg: string;
  /** Soft radial wash behind the monster */
  glow: string;
  /** Readability wash over the habitat photo */
  habitatScrim: string;
  /** Tab bar / chrome behind the nav */
  chrome: string;
}

export const NILLY_PALETTE: MonsterPalette = {
  accent: "#52b788",
  accentLight: "#b8f5c8",
  accentDark: "#1a4d2e",
  text: "#1a5c3a",
  tabTint: "#52b788",
  monster: "nilly",

  page: "#e8f0e6",
  surface: "#f4f7f0",
  surfaceRaised: "#fbfaf4",
  ink: "#1e3a2f",
  inkMuted: "#5a6b60",
  line: "rgba(30,58,47,0.10)",
  accentInk: "#ffffff",
  accentSoft: "#c8e6c0",
  onSoft: "#1a5c3a",

  particle: "#3aab6f",
  barTrack: "rgba(30,58,47,0.12)",
  panelBg: "rgba(244,247,240,0.92)",
  glow: "rgba(82,183,136,0.20)",
  habitatScrim: "rgba(232,240,230,0.18)",
  chrome: "#e8f0e6",
};

export const LUNA_PALETTE: MonsterPalette = {
  accent: "#cc2222",
  accentLight: "#2a0a2a",
  accentDark: "#1a0a1a",
  text: "#f0e0e0",
  tabTint: "#cc2222",
  monster: "luna",

  page: "#100e16",
  surface: "#1a1622",
  surfaceRaised: "#241c2c",
  ink: "#f0e6d3",
  inkMuted: "#9a8fa0",
  line: "rgba(240,230,211,0.10)",
  accentInk: "#f0e6d3",
  accentSoft: "#3a1220",
  onSoft: "#f0e0e0",

  particle: "#e8b86d",
  barTrack: "rgba(240,230,211,0.12)",
  panelBg: "rgba(16,14,22,0.90)",
  glow: "rgba(232,184,109,0.16)",
  habitatScrim: "rgba(8,6,14,0.28)",
  chrome: "#100e16",
};

/** Fallback palette used before monster selection (defaults to Nilly) */
export const DEFAULT_PALETTE: MonsterPalette = NILLY_PALETTE;
