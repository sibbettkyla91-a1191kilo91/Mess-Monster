import { create } from "zustand";
import { persist } from "zustand/middleware";
import { rescheduleDailyNudges } from "@/utils/daily-nudge";
import { localDayString } from "@/utils/local-day";
import {
  AdultVariant,
  EvolutionStage,
  PetSlice,
  PetState,
  TaskCategory,
} from "./types";
import {
  MONSTER_IDS,
  MonsterId,
  PET_SLICE_KEYS,
  resolveMonsterId,
} from "./monster-id";
import { isPlayerPremium } from "./premium";
import {
  arrayOr,
  createSafeStorage,
  finiteNumberOr,
  guardHydrationStep,
  isRecord,
  oneOf,
  oneOfOrNull,
  recordOfRecords,
  recordOr,
  safeMigrate,
} from "./safe-persist";
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
    claimedMilestones: [],
  };
}

const ADULT_VARIANTS: readonly AdultVariant[] = [
  "base",
  "kitchen",
  "livingroom",
  "bedroom",
  "bathroom",
];

/**
 * Coerce whatever was persisted for one monster into a PetSlice every
 * selector can trust: finite, clamped stats; known stages and variants;
 * numeric completion counts. Anything else falls back to a fresh egg's value.
 */
function pickPetSlice(source: unknown): PetSlice {
  const now = Date.now();
  const defaults = createDefaultPetSlice(now);
  const src = recordOr(source);
  const completions: PetSlice["categoryCompletions"] = {};
  for (const [category, count] of Object.entries(
    recordOr(src.categoryCompletions),
  )) {
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
      completions[category as TaskCategory] = count;
    }
  }
  return {
    health: clamp(finiteNumberOr(src.health, defaults.health)),
    happiness: clamp(finiteNumberOr(src.happiness, defaults.happiness)),
    lastCaredAt: safeTimestamp(src.lastCaredAt, now),
    lastSessionAt: safeTimestamp(src.lastSessionAt, now),
    evolutionStage: oneOf(src.evolutionStage, STAGE_ORDER, "egg"),
    totalPointsEarned: Math.max(
      0,
      finiteNumberOr(src.totalPointsEarned, defaults.totalPointsEarned),
    ),
    adultVariant: oneOf(src.adultVariant, ADULT_VARIANTS, "base"),
    categoryCompletions: completions,
    pendingEvolution: oneOfOrNull(src.pendingEvolution, STAGE_ORDER),
    pendingPremiumGate: oneOfOrNull(src.pendingPremiumGate, STAGE_ORDER),
    premiumGateShownFor: oneOfOrNull(src.premiumGateShownFor, STAGE_ORDER),
    claimedMilestones: [
      ...new Set(
        arrayOr(src.claimedMilestones).filter(
          (m): m is number =>
            typeof m === "number" && Number.isInteger(m) && m > 0,
        ),
      ),
    ],
  };
}

type PersistedPetState = ReturnType<typeof partializePet>;

function partializePet(s: PetStore) {
  return {
    byMonster: s.byMonster,
    legacySharedPet: s.legacySharedPet,
    claimedStreakMilestones: s.claimedStreakMilestones,
    pendingMilestoneBanner: s.pendingMilestoneBanner,
    appliedRewardGrants: s.appliedRewardGrants,
    appliedPurchases: s.appliedPurchases,
    appliedFeeds: s.appliedFeeds,
    unsettledMilestones: s.unsettledMilestones,
  };
}

function pickUnsettledMilestone(source: unknown): UnsettledMilestone | null {
  if (!isRecord(source)) return null;
  const monster = oneOfOrNull(source.monster, MONSTER_IDS);
  const level = source.level;
  if (!monster || typeof level !== "number" || !Number.isInteger(level)) {
    return null;
  }
  if (typeof source.id !== "string") return null;
  return { id: source.id, monster, level };
}

/**
 * Give a persisted pet record — same version, migrated, or damaged — a
 * shape the store can run on. zustand's default merge is a shallow spread,
 * so a save missing `byMonster.luna` or carrying NaN health would otherwise
 * reach selectors untouched. Exported for tests.
 */
export function sanitizePetPersisted(persisted: unknown): PersistedPetState {
  const src = recordOr(persisted);
  const by = recordOr(src.byMonster);
  const byMonster = {
    nilly: pickPetSlice(by.nilly),
    luna: pickPetSlice(by.luna),
  };
  const banner = src.pendingMilestoneBanner;
  return {
    byMonster,
    legacySharedPet: isRecord(src.legacySharedPet)
      ? pickPetSlice(src.legacySharedPet)
      : null,
    claimedStreakMilestones: arrayOr(src.claimedStreakMilestones).filter(
      (m): m is number => typeof m === "number" && Number.isFinite(m),
    ),
    pendingMilestoneBanner:
      typeof banner === "number" && Number.isFinite(banner) ? banner : null,
    appliedRewardGrants: recordOfRecords(
      src.appliedRewardGrants,
    ) as PetStore["appliedRewardGrants"],
    appliedPurchases: recordOfRecords(
      src.appliedPurchases,
    ) as PetStore["appliedPurchases"],
    appliedFeeds: recordOfRecords(src.appliedFeeds) as PetStore["appliedFeeds"],
    unsettledMilestones: arrayOr(src.unsettledMilestones)
      .map(pickUnsettledMilestone)
      .filter((m): m is UnsettledMilestone => m !== null),
  };
}

function mergePetState(persisted: unknown, current: PetStore): PetStore {
  if (persisted === undefined) return current;
  const clean = sanitizePetPersisted(persisted);
  // The flat fields mirror the selected monster. The player store may not
  // have hydrated yet; afterHydrate and the selectedMonster subscription
  // re-flatten once it has.
  return { ...current, ...clean, ...clean.byMonster[activeMonsterId()] };
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
  // Runs on a later tick, outside persist's promise chain: a throw here
  // would be an uncaught exception on every launch, not a rejected
  // hydration — guard it all the same.
  const run = () =>
    guardHydrationStep("mm-pet", () => {
      assignLegacyPetToSelectedMonster();
      then();
    });
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

/**
 * Durable intent that a progression milestone's payout (player points and/or
 * a store item) is still owed. Written in the same set() that marks the
 * level claimed, so a crash between "claimed" and "paid" is finished by
 * store/progression-milestones.ts on the next start.
 */
export type UnsettledMilestone = {
  id: string;
  monster: MonsterId;
  level: number;
};

interface PetStore extends PetState {
  byMonster: Record<MonsterId, PetSlice>;
  /** Old single-blob save waiting to land on the selected monster. */
  legacySharedPet: PetSlice | null;
  appliedRewardGrants: Record<string, PetGrantReceipt>;
  appliedPurchases: Record<string, PetPurchaseReceipt>;
  appliedFeeds: Record<string, PetFeedReceipt>;
  unsettledMilestones: UnsettledMilestone[];
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
  /**
   * Mark a progression level's payout as claimed for one monster and record
   * the intent to pay it. Returns false if it was already claimed — the
   * caller must then hand out nothing new (recovery still finishes any
   * intent left in unsettledMilestones).
   */
  reserveMilestone: (milestone: UnsettledMilestone) => boolean;
  clearUnsettledMilestone: (id: string) => void;
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
      unsettledMilestones: [],

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

      reserveMilestone: (milestone) => {
        let reserved = false;
        set((s) => {
          const slice = s.byMonster[milestone.monster];
          const pending = s.unsettledMilestones ?? [];
          if (slice.claimedMilestones.includes(milestone.level)) {
            return {};
          }
          reserved = true;
          return {
            ...writeSlice(s, milestone.monster, {
              claimedMilestones: [...slice.claimedMilestones, milestone.level],
            }),
            unsettledMilestones: pending.some((m) => m.id === milestone.id)
              ? pending
              : [...pending, milestone],
          };
        });
        return reserved;
      },

      clearUnsettledMilestone: (id) => {
        set((s) => ({
          unsettledMilestones: (s.unsettledMilestones ?? []).filter(
            (m) => m.id !== id,
          ),
        }));
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
      migrate: safeMigrate("mm-pet", migratePetState),
      storage: createSafeStorage(),
      partialize: partializePet,
      merge: mergePetState,
      // PERFORMANCE: Defer decay application to next tick instead of blocking hydration.
      // This unblocks the initial render and defers heavy computation to after the UI is ready.
      onRehydrateStorage: () => (state) => {
        if (state) {
          const afterLegacyAssigned = () => {
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
          };
          const afterHydrate = () =>
            assignLegacyOncePlayerReady(afterLegacyAssigned);
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
