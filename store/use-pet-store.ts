import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { rescheduleDailyNudges } from "@/utils/daily-nudge";
import { localDayString } from "@/utils/local-day";
import {
  AdultVariant,
  EvolutionStage,
  PetSlice,
  PetState,
  TaskCategory,
} from "./types";
import { MonsterId, PET_SLICE_KEYS, resolveMonsterId } from "./monster-id";
import { isPlayerPremium } from "./premium";
import { usePlayerStore } from "./use-player-store";

const STREAK_MILESTONES = [3, 7, 14, 30];

export type PetMood = "thriving" | "happy" | "neutral" | "sad" | "sick";

export const FEED_HEALTH_BOOST = 8;
export const FEED_HAPPINESS_BOOST = 8;
export const PLAY_HEALTH_BOOST = 3;
export const PLAY_HAPPINESS_BOOST = 8;
export const PET_HAPPINESS_BOOST = 3;

// Both points AND days must be met to evolve. Never de-evolve.
const EVOLUTION_THRESHOLDS: Partial<
  Record<EvolutionStage, { points: number; days: number }>
> = {
  baby: { points: 50, days: 3 },
  teen: { points: 200, days: 7 },
  adult: { points: 500, days: 14 },
};

const STAGE_ORDER: EvolutionStage[] = [
  "egg",
  "baby",
  "teen",
  "adult",
  "ascended",
];

// Adult variant is determined by which room category the user has completed most (lifetime).
const ROOM_CATEGORY_MAP: Partial<Record<TaskCategory, AdultVariant>> = {
  kitchen: "kitchen",
  living_room: "livingroom",
  bedroom: "bedroom",
  bathroom: "bathroom",
};

const HEALTH_DECAY_RATE = 1.5; // pts lost per hour
const HAPPINESS_DECAY_RATE = 2.0; // pts lost per hour
const HEALTH_CARE_BOOST = 15;
const HAPPINESS_CARE_BOOST = 20;
const MIN_DECAY_HOURS = 0.01; // ~36 s — skip trivially small gaps

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}

/** True only for a real, positive unix-ms timestamp that is not in the future. */
function isValidTimestamp(value: unknown, now: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= now
  );
}

function safeTimestamp(value: unknown, now: number): number {
  return isValidTimestamp(value, now) ? value : now;
}

function activeMonsterId(): MonsterId {
  return resolveMonsterId(usePlayerStore.getState().selectedMonster);
}

export function createDefaultPetSlice(now = Date.now()): PetSlice {
  return {
    health: 100,
    happiness: 100,
    lastCaredAt: now,
    lastSessionAt: now,
    evolutionStage: "egg",
    totalPointsEarned: 0,
    adultVariant: "base",
    categoryCompletions: {},
    pendingEvolution: null,
    pendingPremiumGate: null,
    premiumGateShownFor: null,
  };
}

function pickPetSlice(source: Record<string, unknown> | PetSlice): PetSlice {
  const now = Date.now();
  const defaults = createDefaultPetSlice(now);
  return {
    health: typeof source.health === "number" ? source.health : defaults.health,
    happiness:
      typeof source.happiness === "number"
        ? source.happiness
        : defaults.happiness,
    lastCaredAt: safeTimestamp(source.lastCaredAt, now),
    lastSessionAt: safeTimestamp(source.lastSessionAt, now),
    evolutionStage:
      typeof source.evolutionStage === "string"
        ? (source.evolutionStage as EvolutionStage)
        : defaults.evolutionStage,
    totalPointsEarned:
      typeof source.totalPointsEarned === "number"
        ? source.totalPointsEarned
        : defaults.totalPointsEarned,
    adultVariant:
      typeof source.adultVariant === "string"
        ? (source.adultVariant as AdultVariant)
        : defaults.adultVariant,
    categoryCompletions:
      source.categoryCompletions &&
      typeof source.categoryCompletions === "object"
        ? (source.categoryCompletions as PetSlice["categoryCompletions"])
        : {},
    pendingEvolution:
      (source.pendingEvolution as EvolutionStage | null) ?? null,
    pendingPremiumGate:
      (source.pendingPremiumGate as EvolutionStage | null) ?? null,
    premiumGateShownFor:
      (source.premiumGateShownFor as EvolutionStage | null) ?? null,
  };
}

function flattenActive(s: {
  byMonster: Record<MonsterId, PetSlice>;
}): PetSlice {
  return s.byMonster[activeMonsterId()];
}

function writeSlice(
  s: { byMonster: Record<MonsterId, PetSlice> },
  monster: MonsterId,
  patch: Partial<PetSlice>,
): { byMonster: Record<MonsterId, PetSlice> } & Partial<PetSlice> {
  const nextSlice = { ...s.byMonster[monster], ...patch };
  const byMonster = { ...s.byMonster, [monster]: nextSlice };
  if (monster === activeMonsterId()) {
    return { byMonster, ...nextSlice };
  }
  return { byMonster };
}

/**
 * Re-run the existing evolution check for a premium player once both sides of
 * it are actually restored. The check straddles two independently persisted
 * stores — stage and lifetime points here, isPremium and activeDaysCount in
 * the player store — and otherwise only ever runs from the upgrade button. A
 * player who force-quit between unlocking premium and evolving would come back
 * premium at teen with the gate already marked shown, leaving nothing to
 * trigger it. Non-premium players are left alone: an unhydrated default must
 * never stand in for a real answer, and cold start is no place to raise a
 * paywall.
 */
function recheckPremiumEvolutionOnceHydrated(): void {
  const recheckIfPremium = () => {
    if (!isPlayerPremium()) return;
    usePetStore.getState().recheckEvolution();
  };

  if (usePlayerStore.persist.hasHydrated()) {
    recheckIfPremium();
    return;
  }

  // Hydration order between the two stores isn't guaranteed; wait for the
  // authoritative premium value rather than reading defaults.
  const stopListening = usePlayerStore.persist.onFinishHydration(() => {
    stopListening();
    recheckIfPremium();
  });
}

/**
 * Shared v3 saves land on Nilly first. After the player store says who was
 * selected, a Luna player gets that same progress and Nilly starts fresh
 * (egg, full health/happiness). A brand-new second monster is not neglected.
 */
export function assignLegacyPetToSelectedMonster(): void {
  const state = usePetStore.getState();
  if (!state.legacySharedPet) return;
  const target = resolveMonsterId(usePlayerStore.getState().selectedMonster);
  // Shared saves are staged on Nilly during migrate. Do not replay that
  // snapshot — recovery may have already written to the live slice.
  if (target === "nilly") {
    usePetStore.setState({ legacySharedPet: null });
    return;
  }
  const staged = state.byMonster.nilly;
  usePetStore.setState({
    byMonster: {
      nilly: createDefaultPetSlice(),
      luna: staged,
    },
    legacySharedPet: null,
    ...staged,
  });
}

function assignLegacyOncePlayerReady(then: () => void): void {
  const run = () => {
    assignLegacyPetToSelectedMonster();
    then();
  };
  if (usePlayerStore.persist.hasHydrated()) {
    run();
    return;
  }
  const stop = usePlayerStore.persist.onFinishHydration(() => {
    stop();
    run();
  });
}

export function deriveMood(health: number, happiness: number): PetMood {
  const avg = (health + happiness) / 2;
  if (avg >= 75) return "thriving";
  if (avg >= 55) return "happy";
  if (avg >= 35) return "neutral";
  if (avg >= 15) return "sad";
  return "sick";
}

function nextStage(current: EvolutionStage): EvolutionStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function determineAdultVariant(
  categoryCompletions: Partial<Record<TaskCategory, number>>,
): AdultVariant {
  let maxCount = 0;
  let topCat: TaskCategory | null = null;
  let tied = false;

  for (const [cat, count] of Object.entries(categoryCompletions) as [
    TaskCategory,
    number,
  ][]) {
    const variant = ROOM_CATEGORY_MAP[cat];
    if (!variant || !count) continue;
    if (count > maxCount) {
      maxCount = count;
      topCat = cat;
      tied = false;
    } else if (count === maxCount) {
      tied = true;
    }
  }

  if (!topCat || tied || !ROOM_CATEGORY_MAP[topCat]) return "base";
  return ROOM_CATEGORY_MAP[topCat]!;
}

export type PetGrantReceipt = {
  tracked?: true;
  cared?: true;
  streakMilestone?: number;
};

export type PetPurchaseReceipt = {
  cared?: true;
};

export type PetFeedReceipt = {
  fed?: true;
  itemId?: string;
  monsterId: MonsterId;
};

interface PetStore extends PetState {
  byMonster: Record<MonsterId, PetSlice>;
  /** Old single-blob save waiting to land on the selected monster. */
  legacySharedPet: PetSlice | null;
  appliedRewardGrants: Record<string, PetGrantReceipt>;
  appliedPurchases: Record<string, PetPurchaseReceipt>;
  appliedFeeds: Record<string, PetFeedReceipt>;
  care: () => void;
  addHappiness: (amount: number) => void;
  applyDecay: () => void;
  applyFeed: (feedId: string, monster: MonsterId, itemId: string) => void;
  applyPlay: (monster: MonsterId) => void;
  trackEarned: (amount: number, category?: TaskCategory) => void;
  recheckEvolution: () => void; // re-run evolution check (e.g., after premium unlock)
  checkStreakMilestones: () => void;
  unclaimedStreakMilestone: () => number | undefined;
  recordStreakMilestone: (hit: number) => void;
  clearMilestoneBanner: () => void;
  clearPendingEvolution: () => void;
  clearPremiumGate: () => void;
  applyRewardGrantTracked: (
    grantId: string,
    amount: number,
    category?: TaskCategory,
  ) => void;
  applyRewardGrantCared: (grantId: string) => void;
  applyRewardGrantStreakMilestone: (grantId: string, hit: number) => void;
  applyPurchaseCared: (purchaseId: string) => void;
}

function computeTrackEarnedUpdate(
  s: PetSlice,
  amount: number,
  category: TaskCategory | undefined,
): Partial<PetSlice> {
  const newTotal = s.totalPointsEarned + amount;

  const newCategoryCompletions: Partial<Record<TaskCategory, number>> = category
    ? {
        ...s.categoryCompletions,
        [category]: (s.categoryCompletions[category] ?? 0) + 1,
      }
    : s.categoryCompletions;

  const baseUpdate = {
    totalPointsEarned: newTotal,
    categoryCompletions: newCategoryCompletions,
  };

  const next = nextStage(s.evolutionStage);

  // Already at max stage or ascended (not yet implemented)
  if (!next || next === "ascended") return baseUpdate;

  const threshold = EVOLUTION_THRESHOLDS[next];
  if (!threshold) return baseUpdate;

  const { activeDaysCount } = usePlayerStore.getState();
  const meetsConditions =
    newTotal >= threshold.points && activeDaysCount >= threshold.days;
  if (!meetsConditions) return baseUpdate;

  // Premium gate: adult requires premium (ascended is reserved; gate checked via nextStage)
  if (next === "adult") {
    if (!isPlayerPremium()) {
      // Show gate once per stage — don't repeat if already shown
      if (s.premiumGateShownFor === next) return baseUpdate;
      return {
        ...baseUpdate,
        pendingPremiumGate: next,
        premiumGateShownFor: next,
      };
    }
  }

  // Evolve!
  const adultVariant =
    next === "adult"
      ? determineAdultVariant(newCategoryCompletions)
      : s.adultVariant;

  return {
    ...baseUpdate,
    evolutionStage: next,
    adultVariant,
    pendingEvolution: next,
    pendingPremiumGate: null,
  };
}

function recheckOneMonster(s: PetStore, monster: MonsterId): Partial<PetSlice> {
  const slice = s.byMonster[monster];
  const { activeDaysCount } = usePlayerStore.getState();
  const next = nextStage(slice.evolutionStage);
  if (!next || next === "ascended") return {};

  const threshold = EVOLUTION_THRESHOLDS[next];
  if (!threshold) return {};
  if (
    slice.totalPointsEarned < threshold.points ||
    activeDaysCount < threshold.days
  )
    return {};

  if (next === "adult" && !isPlayerPremium()) {
    if (slice.premiumGateShownFor !== next) {
      return { pendingPremiumGate: next, premiumGateShownFor: next };
    }
    return {};
  }

  const adultVariant =
    next === "adult"
      ? determineAdultVariant(slice.categoryCompletions)
      : slice.adultVariant;

  return {
    evolutionStage: next,
    adultVariant,
    pendingEvolution: next,
    pendingPremiumGate: null,
  };
}

const nowInit = Date.now();
const defaultNilly = createDefaultPetSlice(nowInit);
const defaultLuna = createDefaultPetSlice(nowInit);

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      ...defaultNilly,
      byMonster: { nilly: defaultNilly, luna: defaultLuna },
      legacySharedPet: null,
      claimedStreakMilestones: [],
      pendingMilestoneBanner: null,
      appliedRewardGrants: {},
      appliedPurchases: {},
      appliedFeeds: {},

      care: () => {
        const monster = activeMonsterId();
        set((s) =>
          writeSlice(s, monster, {
            health: clamp(s.byMonster[monster].health + HEALTH_CARE_BOOST),
            happiness: clamp(
              s.byMonster[monster].happiness + HAPPINESS_CARE_BOOST,
            ),
            lastCaredAt: Date.now(),
          }),
        );
        // The monster was just cared for — push the nudge window to
        // tomorrow. No-ops without notification permission.
        const { monsterName } = usePlayerStore.getState();
        void rescheduleDailyNudges(monsterName, true);
      },

      addHappiness: (amount: number) => {
        const monster = activeMonsterId();
        set((s) =>
          writeSlice(s, monster, {
            happiness: clamp(s.byMonster[monster].happiness + amount),
          }),
        );
      },

      applyFeed: (feedId, monster, itemId) => {
        let applied = false;
        set((s) => {
          if (s.appliedFeeds[feedId]?.fed) return {};
          applied = true;
          const slice = s.byMonster[monster];
          return {
            ...writeSlice(s, monster, {
              health: clamp(slice.health + FEED_HEALTH_BOOST),
              happiness: clamp(slice.happiness + FEED_HAPPINESS_BOOST),
              lastCaredAt: Date.now(),
            }),
            appliedFeeds: {
              ...s.appliedFeeds,
              [feedId]: { fed: true, itemId, monsterId: monster },
            },
          };
        });
        if (applied) {
          const { monsterName } = usePlayerStore.getState();
          void rescheduleDailyNudges(monsterName, true);
        }
      },

      applyPlay: (monster) => {
        set((s) =>
          writeSlice(s, monster, {
            health: clamp(s.byMonster[monster].health + PLAY_HEALTH_BOOST),
            happiness: clamp(
              s.byMonster[monster].happiness + PLAY_HAPPINESS_BOOST,
            ),
            lastCaredAt: Date.now(),
          }),
        );
        const { monsterName } = usePlayerStore.getState();
        void rescheduleDailyNudges(monsterName, true);
      },

      trackEarned: (amount, category) => {
        const monster = activeMonsterId();
        set((s) =>
          writeSlice(
            s,
            monster,
            computeTrackEarnedUpdate(s.byMonster[monster], amount, category),
          ),
        );
      },

      recheckEvolution: () => {
        set((s) => {
          let nextBy = s.byMonster;
          let flatten: Partial<PetSlice> = {};
          for (const monster of ["nilly", "luna"] as MonsterId[]) {
            const patch = recheckOneMonster(
              { ...s, byMonster: nextBy },
              monster,
            );
            if (Object.keys(patch).length === 0) continue;
            const nextSlice = { ...nextBy[monster], ...patch };
            nextBy = { ...nextBy, [monster]: nextSlice };
            if (monster === activeMonsterId()) flatten = nextSlice;
          }
          if (nextBy === s.byMonster) return {};
          return { byMonster: nextBy, ...flatten };
        });
      },

      checkStreakMilestones: () => {
        const streak = usePlayerStore.getState().streak;
        const { claimedStreakMilestones } = get();
        const hit = STREAK_MILESTONES.find(
          (m) => streak >= m && !claimedStreakMilestones.includes(m),
        );
        if (!hit) return;
        set((s) => ({
          claimedStreakMilestones: [...s.claimedStreakMilestones, hit],
          pendingMilestoneBanner: hit,
        }));
        usePlayerStore.getState().earnPoints(50);
      },

      unclaimedStreakMilestone: () => {
        const streak = usePlayerStore.getState().streak;
        const { claimedStreakMilestones } = get();
        return STREAK_MILESTONES.find(
          (m) => streak >= m && !claimedStreakMilestones.includes(m),
        );
      },

      recordStreakMilestone: (hit) => {
        set((s) => {
          if (s.claimedStreakMilestones.includes(hit)) {
            return s.pendingMilestoneBanner === hit
              ? {}
              : { pendingMilestoneBanner: hit };
          }
          return {
            claimedStreakMilestones: [...s.claimedStreakMilestones, hit],
            pendingMilestoneBanner: hit,
          };
        });
      },

      clearMilestoneBanner: () => set({ pendingMilestoneBanner: null }),

      clearPendingEvolution: () => {
        const monster = activeMonsterId();
        set((s) => writeSlice(s, monster, { pendingEvolution: null }));
      },

      clearPremiumGate: () => {
        const monster = activeMonsterId();
        set((s) => writeSlice(s, monster, { pendingPremiumGate: null }));
      },

      applyRewardGrantTracked: (grantId, amount, category) => {
        const monster = activeMonsterId();
        set((s) => {
          if (s.appliedRewardGrants[grantId]?.tracked) return {};
          return {
            ...writeSlice(
              s,
              monster,
              computeTrackEarnedUpdate(s.byMonster[monster], amount, category),
            ),
            appliedRewardGrants: {
              ...s.appliedRewardGrants,
              [grantId]: { ...s.appliedRewardGrants[grantId], tracked: true },
            },
          };
        });
      },

      applyRewardGrantCared: (grantId) => {
        let applied = false;
        const monster = activeMonsterId();
        set((s) => {
          if (s.appliedRewardGrants[grantId]?.cared) return {};
          applied = true;
          const slice = s.byMonster[monster];
          return {
            ...writeSlice(s, monster, {
              health: clamp(slice.health + HEALTH_CARE_BOOST),
              happiness: clamp(slice.happiness + HAPPINESS_CARE_BOOST),
              lastCaredAt: Date.now(),
            }),
            appliedRewardGrants: {
              ...s.appliedRewardGrants,
              [grantId]: { ...s.appliedRewardGrants[grantId], cared: true },
            },
          };
        });
        if (applied) {
          const { monsterName } = usePlayerStore.getState();
          void rescheduleDailyNudges(monsterName, true);
        }
      },

      applyRewardGrantStreakMilestone: (grantId, hit) => {
        set((s) => {
          const alreadyRecorded =
            s.appliedRewardGrants[grantId]?.streakMilestone === hit;
          const alreadyClaimed = s.claimedStreakMilestones.includes(hit);
          if (
            alreadyRecorded &&
            alreadyClaimed &&
            s.pendingMilestoneBanner === hit
          ) {
            return {};
          }
          return {
            claimedStreakMilestones: alreadyClaimed
              ? s.claimedStreakMilestones
              : [...s.claimedStreakMilestones, hit],
            pendingMilestoneBanner: hit,
            appliedRewardGrants: {
              ...s.appliedRewardGrants,
              [grantId]: {
                ...s.appliedRewardGrants[grantId],
                streakMilestone: hit,
              },
            },
          };
        });
      },

      applyPurchaseCared: (purchaseId) => {
        let applied = false;
        const monster = activeMonsterId();
        set((s) => {
          const receipts = s.appliedPurchases ?? {};
          if (receipts[purchaseId]?.cared) return {};
          applied = true;
          const slice = s.byMonster[monster];
          return {
            ...writeSlice(s, monster, {
              health: clamp(slice.health + HEALTH_CARE_BOOST),
              happiness: clamp(slice.happiness + HAPPINESS_CARE_BOOST),
              lastCaredAt: Date.now(),
            }),
            appliedPurchases: {
              ...receipts,
              [purchaseId]: { ...receipts[purchaseId], cared: true },
            },
          };
        });
        if (applied) {
          const { monsterName } = usePlayerStore.getState();
          void rescheduleDailyNudges(monsterName, true);
        }
      },

      applyDecay: () => {
        const now = Date.now();
        set((s) => {
          let nextBy = s.byMonster;
          let changed = false;
          for (const monster of ["nilly", "luna"] as MonsterId[]) {
            const slice = nextBy[monster];
            const lastSessionAt = slice.lastSessionAt;
            const safeLastSessionAt = safeTimestamp(lastSessionAt, now);
            const elapsedHours = (now - safeLastSessionAt) / 3_600_000;
            if (elapsedHours < MIN_DECAY_HOURS) {
              if (safeLastSessionAt !== lastSessionAt) {
                nextBy = {
                  ...nextBy,
                  [monster]: { ...slice, lastSessionAt: now },
                };
                changed = true;
              }
              continue;
            }
            nextBy = {
              ...nextBy,
              [monster]: {
                ...slice,
                health: clamp(slice.health - HEALTH_DECAY_RATE * elapsedHours),
                happiness: clamp(
                  slice.happiness - HAPPINESS_DECAY_RATE * elapsedHours,
                ),
                lastSessionAt: now,
              },
            };
            changed = true;
          }
          if (!changed) return {};
          return { byMonster: nextBy, ...nextBy[activeMonsterId()] };
        });
      },
    }),
    {
      name: "mm-pet",
      version: 4,
      migrate: migratePetState,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        byMonster: s.byMonster,
        legacySharedPet: s.legacySharedPet,
        claimedStreakMilestones: s.claimedStreakMilestones,
        pendingMilestoneBanner: s.pendingMilestoneBanner,
        appliedRewardGrants: s.appliedRewardGrants,
        appliedPurchases: s.appliedPurchases,
        appliedFeeds: s.appliedFeeds,
      }),
      // PERFORMANCE: Defer decay application to next tick instead of blocking hydration.
      // This unblocks the initial render and defers heavy computation to after the UI is ready.
      onRehydrateStorage: () => (state) => {
        if (state) {
          const afterHydrate = () => {
            assignLegacyOncePlayerReady(() => {
              const live = usePetStore.getState();
              const now = Date.now();
              let nextBy = live.byMonster;
              let repaired = false;
              for (const monster of ["nilly", "luna"] as MonsterId[]) {
                const slice = nextBy[monster];
                const lastCaredAt = safeTimestamp(slice.lastCaredAt, now);
                if (lastCaredAt !== slice.lastCaredAt) {
                  nextBy = {
                    ...nextBy,
                    [monster]: { ...slice, lastCaredAt },
                  };
                  repaired = true;
                }
              }
              if (repaired) {
                usePetStore.setState({
                  byMonster: nextBy,
                  ...nextBy[activeMonsterId()],
                });
              } else {
                usePetStore.setState({ ...flattenActive(live) });
              }
              live.applyDecay();
              // Re-plan the nudge window from fresh persisted state (days may
              // have passed since the last session). No-ops without permission.
              const { monsterName } = usePlayerStore.getState();
              const caredAt = usePetStore.getState().lastCaredAt;
              const caredToday =
                localDayString(new Date(caredAt)) === localDayString();
              void rescheduleDailyNudges(monsterName, caredToday);
              recheckPremiumEvolutionOnceHydrated();
            });
          };
          // Use setImmediate to schedule decay on the next event loop iteration.
          // This allows React to complete the initial render before we do heavy calculations.
          if (typeof setImmediate !== "undefined") {
            setImmediate(afterHydrate);
          } else {
            // Fallback for environments without setImmediate (e.g., some React Native setups)
            setTimeout(afterHydrate, 0);
          }
        }
      },
    },
  ),
);

export function migratePetState(persistedState: any, version: number): any {
  // Migrate from old integer stage (0=hatchling, 1=growing, 2=mature, 3=evolved)
  const STAGE_MAP: Record<number, EvolutionStage> = {
    0: "egg",
    1: "baby",
    2: "teen",
    3: "adult",
  };
  const oldStage = persistedState?.evolutionStage;
  const migratedStage: EvolutionStage =
    typeof oldStage === "number"
      ? (STAGE_MAP[oldStage] ?? "egg")
      : (oldStage ?? "egg");

  const now = Date.now();
  const v3 = {
    adultVariant: "base" as AdultVariant,
    categoryCompletions: {},
    pendingEvolution: null,
    pendingPremiumGate: null,
    premiumGateShownFor: null,
    ...persistedState,
    evolutionStage: migratedStage,
    lastSessionAt: safeTimestamp(persistedState?.lastSessionAt, now),
    lastCaredAt: safeTimestamp(persistedState?.lastCaredAt, now),
    appliedRewardGrants: persistedState?.appliedRewardGrants ?? {},
    appliedPurchases: persistedState?.appliedPurchases ?? {},
    claimedStreakMilestones: persistedState?.claimedStreakMilestones ?? [],
    pendingMilestoneBanner: persistedState?.pendingMilestoneBanner ?? null,
  };

  if (persistedState?.byMonster?.nilly && persistedState?.byMonster?.luna) {
    const nilly = pickPetSlice(persistedState.byMonster.nilly);
    const luna = pickPetSlice(persistedState.byMonster.luna);
    return {
      ...v3,
      byMonster: { nilly, luna },
      legacySharedPet: persistedState.legacySharedPet
        ? pickPetSlice(persistedState.legacySharedPet)
        : null,
      appliedFeeds: persistedState.appliedFeeds ?? {},
      ...nilly,
    };
  }

  const legacy = pickPetSlice({ ...v3, evolutionStage: migratedStage });
  return {
    ...v3,
    ...legacy,
    byMonster: {
      nilly: legacy,
      luna: createDefaultPetSlice(now),
    },
    legacySharedPet: version < 4 ? legacy : null,
    appliedFeeds: persistedState?.appliedFeeds ?? {},
  };
}

function pickSlicePatch(patch: Record<string, unknown>): Partial<PetSlice> {
  const out: Partial<PetSlice> = {};
  for (const key of PET_SLICE_KEYS) {
    if (key in patch && patch[key] !== undefined) {
      (out as Record<string, unknown>)[key] = patch[key];
    }
  }
  return out;
}

const innerPetSetState = usePetStore.setState.bind(usePetStore);
usePetStore.setState = ((
  partial: Parameters<typeof usePetStore.setState>[0],
  replace?: boolean,
) => {
  if (replace === true) {
    innerPetSetState(partial as PetStore, true);
    return;
  }
  const project = (s: PetStore, patch: Partial<PetStore>) => {
    if (patch.byMonster && Object.keys(pickSlicePatch(patch)).length === 0) {
      return { ...patch, ...patch.byMonster[activeMonsterId()] };
    }
    const slicePatch = pickSlicePatch(patch);
    if (Object.keys(slicePatch).length === 0) return patch;
    const id = activeMonsterId();
    const currentBy = patch.byMonster ?? s.byMonster;
    const nextSlice = { ...currentBy[id], ...slicePatch };
    return {
      ...patch,
      byMonster: { ...currentBy, [id]: nextSlice },
      ...nextSlice,
    };
  };
  if (typeof partial === "function") {
    innerPetSetState((s) => {
      const next = partial(s);
      if (!next) return next;
      return project(s, next);
    });
  } else {
    innerPetSetState((s) => project(s, partial));
  }
}) as typeof usePetStore.setState;

usePlayerStore.subscribe((state, prev) => {
  if (state.selectedMonster === prev.selectedMonster) return;
  const slice = usePetStore.getState().byMonster[activeMonsterId()];
  if (slice) innerPetSetState({ ...slice });
});
