import { DEFAULT_PALETTE, LUNA_PALETTE, MonsterPalette, NILLY_PALETTE } from '@/monster-theme';
import { usePlayerStore } from '@/store/use-player-store';

/**
 * Returns the active monster's color palette.
 * Falls back to Nilly (DEFAULT_PALETTE) before monster selection.
 */
export function useMonsterTheme(): MonsterPalette {
  const selectedMonster = usePlayerStore((s) => s.selectedMonster);
  if (selectedMonster === 'luna') return LUNA_PALETTE;
  if (selectedMonster === 'nilly') return NILLY_PALETTE;
  return DEFAULT_PALETTE;
}
