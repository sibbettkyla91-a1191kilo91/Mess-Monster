import { usePlayerStore } from "./use-player-store";

/**
 * The only public answer to "is this user premium."
 * The flag is persisted on the player store. Do not add a second flag
 * on the subscription store or derive entitlement from trial/receipts.
 */
export function isPlayerPremium(): boolean {
  return usePlayerStore.getState().isPremium;
}

/** React subscription to the same flag. */
export function useIsPremium(): boolean {
  return usePlayerStore((s) => s.isPremium);
}
