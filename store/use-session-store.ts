import { create } from "zustand";

import { MonsterId, resolveMonsterId } from "./monster-id";
import { PresetTask } from "./preset-tasks";
import { usePetStore } from "./use-pet-store";
import { usePlayerStore } from "./use-player-store";
import { TaskProgress } from "./use-tasks-store";

/**
 * Session-only facts about this launch. In memory on purpose — NOT persisted
 * (the seven persisted stores stay seven). Nothing here is a streak, a
 * score, or a punishment: it only remembers "the player just came back
 * after a while" long enough for Home to say hello once.
 */

export const WELCOME_BACK_THRESHOLD_MS = 4 * 3_600_000;

type SessionState = {
  /** Home should greet the player once, then call consumeWelcome. */
  pendingWelcome: boolean;
  /** How long the active monster went without a session, in ms. */
  awayMs: number;
  noteReturn: (awayMs: number) => void;
  consumeWelcome: () => void;
};

export const useSessionStore = create<SessionState>()((set) => ({
  pendingWelcome: false,
  awayMs: 0,
  noteReturn: (awayMs) => {
    if (!Number.isFinite(awayMs) || awayMs < WELCOME_BACK_THRESHOLD_MS) return;
    set({ pendingWelcome: true, awayMs });
  },
  consumeWelcome: () => set({ pendingWelcome: false, awayMs: 0 }),
}));

function gapFor(lastSessionAt: number, now: number): number | null {
  if (!Number.isFinite(lastSessionAt) || lastSessionAt <= 0) return null;
  return now - lastSessionAt;
}

/**
 * Foreground return. Call from the AppState handler BEFORE applyDecay: decay
 * stamps lastSessionAt to now, so this is the last moment the gap is
 * readable. Reads only; decay itself is untouched.
 */
export function noteReturnFromLastSession(now: number = Date.now()): void {
  const monster = resolveMonsterId(usePlayerStore.getState().selectedMonster);
  const last = usePetStore.getState().byMonster[monster]?.lastSessionAt;
  const gap = gapFor(last, now);
  if (gap === null) return;
  useSessionStore.getState().noteReturn(gap);
}

/**
 * Cold start. The pet store defers its own decay pass to setImmediate, so a
 * finish-hydration listener still sees the persisted lastSessionAt for both
 * monsters. Snapshot both, then resolve which one is active once the player
 * store has hydrated (their hydration order is not guaranteed). A launch
 * that is still migrating a shared save is skipped: the slice that "was
 * away" may be about to move to the other monster.
 *
 * Call once at module load, before hydration can complete. Returns an
 * unsubscribe for tests.
 */
export function initSessionWelcome(): () => void {
  let stopPlayer: (() => void) | null = null;

  const onPetHydrated = () => {
    const pet = usePetStore.getState();
    if (pet.legacySharedPet) return;
    const now = Date.now();
    const snapshot: Record<MonsterId, number> = {
      nilly: pet.byMonster.nilly.lastSessionAt,
      luna: pet.byMonster.luna.lastSessionAt,
    };
    const resolve = () => {
      const monster = resolveMonsterId(
        usePlayerStore.getState().selectedMonster,
      );
      const gap = gapFor(snapshot[monster], now);
      if (gap === null) return;
      useSessionStore.getState().noteReturn(gap);
    };
    if (usePlayerStore.persist.hasHydrated()) {
      resolve();
      return;
    }
    stopPlayer = usePlayerStore.persist.onFinishHydration(() => {
      stopPlayer?.();
      stopPlayer = null;
      resolve();
    });
  };

  if (usePetStore.persist.hasHydrated()) {
    onPetHydrated();
    return () => stopPlayer?.();
  }
  const stopPet = usePetStore.persist.onFinishHydration(() => {
    stopPet();
    onPetHydrated();
  });
  return () => {
    stopPet();
    stopPlayer?.();
  };
}

/**
 * The gentlest possible offer: today's lowest-point task that has not been
 * started. Pure; Home renders it as the "tiny dare" chip.
 */
export function pickTinyDare(
  dailyRoll: readonly PresetTask[],
  taskProgress: Readonly<Record<string, TaskProgress>>,
): PresetTask | null {
  let best: PresetTask | null = null;
  for (const task of dailyRoll) {
    const state = taskProgress[task.id]?.state ?? "idle";
    if (state !== "idle") continue;
    if (!best || task.pointValue < best.pointValue) best = task;
  }
  return best;
}
