/**
 * Reload guarantees for the gameplay loop: a persisted save comes back with
 * the same ownership, level and claimed milestones; an unfinished milestone
 * payout is completed exactly once on hydration; a foreground replay after
 * that changes nothing.
 */
const mockResolvers: Record<string, (value: string | null) => void> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(
    (key: string) =>
      new Promise((resolve) => {
        mockResolvers[key] = resolve;
      }),
  ),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
  initNotifications: jest.fn().mockResolvedValue(undefined),
}));

const NOW = Date.now();

// Level 3 for Nilly (150+ points) with the level-2 tier claimed and the
// level-3 points milestone marked claimed but never paid (crash mid-payout).
const PET_SAVE = JSON.stringify({
  state: {
    byMonster: {
      nilly: {
        health: 80,
        happiness: 75,
        lastCaredAt: NOW,
        lastSessionAt: NOW,
        evolutionStage: "baby",
        totalPointsEarned: 160,
        adultVariant: "base",
        categoryCompletions: { kitchen: 4 },
        pendingEvolution: null,
        pendingPremiumGate: null,
        premiumGateShownFor: null,
        claimedMilestones: [2, 3],
      },
      luna: {
        health: 100,
        happiness: 100,
        lastCaredAt: NOW,
        lastSessionAt: NOW,
        evolutionStage: "egg",
        totalPointsEarned: 0,
        adultVariant: "base",
        categoryCompletions: {},
        pendingEvolution: null,
        pendingPremiumGate: null,
        premiumGateShownFor: null,
        claimedMilestones: [],
      },
    },
    legacySharedPet: null,
    claimedStreakMilestones: [],
    pendingMilestoneBanner: null,
    appliedRewardGrants: {},
    appliedPurchases: {},
    appliedFeeds: {},
    unsettledMilestones: [{ id: "nilly:milestone:3", monster: "nilly", level: 3 }],
  },
  version: 4,
});

const PLAYER_SAVE = JSON.stringify({
  state: {
    totalPoints: 300,
    spentPoints: 60,
    streak: 2,
    lastActiveDay: "",
    activeDaysCount: 4,
    isPremium: false,
    selectedMonster: "nilly",
    monsterName: "Pip",
    hasCompletedOnboarding: true,
    appliedRewardGrants: {},
    appliedPurchases: {},
  },
  version: 5,
});

const STORE_SAVE = JSON.stringify({
  state: {
    byMonster: {
      nilly: {
        owned: {
          "nilly-food-granola-honey-bar": {
            item: { id: "nilly-food-granola-honey-bar", name: "stale" },
            quantity: 3,
            purchasedAt: NOW,
          },
          "nilly-plant-sunflower": {
            item: { id: "nilly-plant-sunflower", name: "stale" },
            quantity: 1,
            purchasedAt: NOW,
          },
          "nilly-accessory-friendship-bracelet": {
            item: { id: "nilly-accessory-friendship-bracelet", name: "stale" },
            quantity: 1,
            purchasedAt: NOW,
          },
          "food-cookie": {
            item: {
              id: "food-cookie",
              name: "Cookie",
              emoji: "🍪",
              category: "food",
              description: "old",
              price: 15,
              repeatable: true,
            },
            quantity: 1,
            purchasedAt: NOW,
          },
        },
        placed: { "nilly-plant-sunflower": true },
        equipped: { neck: "nilly-accessory-friendship-bracelet" },
      },
      luna: { owned: {}, placed: {}, equipped: {} },
    },
    legacySharedInventory: null,
    unsettledPurchases: [],
    appliedPurchases: {},
    appliedRewardGrants: {},
    unsettledFeeds: [],
    appliedFeeds: {},
  },
  version: 4,
});

function coldStart() {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { usePlayerStore } = require("@/store/use-player-store");
  const { usePetStore } = require("@/store/use-pet-store");
  const { useStoreStore } = require("@/store/use-store-store");
  const {
    recoverUnsettledMilestones,
    subscribeUnsettledMilestoneRecovery,
  } = require("@/store/progression-milestones");
  const { levelForXp, MILESTONES } = require("@/store/progression");
  const { getStoreItem } = require("@/store/store-items");
  const { executeFeed } = require("@/store/recover-unsettled-feeds");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    usePlayerStore,
    usePetStore,
    useStoreStore,
    recoverUnsettledMilestones,
    subscribeUnsettledMilestoneRecovery,
    levelForXp,
    MILESTONES,
    getStoreItem,
    executeFeed,
  };
}

async function flushHydration() {
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("reload", () => {
  it("restores ownership, level and milestones, and finishes the owed payout once", async () => {
    const s = coldStart();
    const stop = s.subscribeUnsettledMilestoneRecovery();
    const level3 = s.MILESTONES.find((m: { level: number }) => m.level === 3);
    expect(level3?.points).toBeGreaterThan(0);

    mockResolvers["mm-store-owned"](STORE_SAVE);
    mockResolvers["mm-pet"](PET_SAVE);
    await flushHydration();
    // Player not hydrated yet: nothing paid, intent still waiting.
    expect(s.usePlayerStore.persist.hasHydrated()).toBe(false);
    expect(s.usePetStore.getState().unsettledMilestones).toHaveLength(1);

    mockResolvers["mm-player"](PLAYER_SAVE);
    await flushHydration();

    // Ownership, refreshed from the catalog; legacy snack kept as-is.
    const shop = s.useStoreStore.getState();
    const nilly = shop.byMonster.nilly;
    expect(nilly.owned["nilly-food-granola-honey-bar"].quantity).toBe(3);
    expect(nilly.owned["nilly-food-granola-honey-bar"].item).toEqual(
      s.getStoreItem("nilly-food-granola-honey-bar"),
    );
    expect(nilly.owned["nilly-plant-sunflower"].quantity).toBe(1);
    expect(nilly.placed).toEqual({ "nilly-plant-sunflower": true });
    expect(nilly.equipped).toEqual({
      neck: "nilly-accessory-friendship-bracelet",
    });
    expect(nilly.owned["food-cookie"].item.name).toBe("Cookie");
    expect(shop.byMonster.luna.owned).toEqual({});

    // Level derived from the persisted points; claimed list intact.
    const pet = s.usePetStore.getState();
    expect(s.levelForXp(pet.byMonster.nilly.totalPointsEarned)).toBe(3);
    expect(pet.byMonster.nilly.claimedMilestones).toEqual([2, 3]);
    expect(pet.byMonster.nilly.evolutionStage).toBe("baby");
    expect(pet.byMonster.luna.claimedMilestones).toEqual([]);

    // The owed level-3 payout landed exactly once.
    expect(s.usePlayerStore.getState().totalPoints).toBe(300 + level3.points);
    expect(pet.unsettledMilestones).toEqual([]);
    expect(
      s.usePlayerStore.getState().appliedRewardGrants["nilly:milestone:3"],
    ).toEqual({ points: true });

    // Foreground replay: nothing changes.
    s.recoverUnsettledMilestones();
    s.recoverUnsettledMilestones();
    expect(s.usePlayerStore.getState().totalPoints).toBe(300 + level3.points);
    expect(s.usePetStore.getState().byMonster.nilly.claimedMilestones).toEqual(
      [2, 3],
    );
    stop();
  });

  it("a legacy snack in the bag is still edible after reload", async () => {
    const s = coldStart();
    mockResolvers["mm-store-owned"](STORE_SAVE);
    mockResolvers["mm-pet"](PET_SAVE);
    mockResolvers["mm-player"](PLAYER_SAVE);
    await flushHydration();

    expect(s.executeFeed("food-cookie")).toBe(true);
    expect(
      s.useStoreStore.getState().byMonster.nilly.owned["food-cookie"].quantity,
    ).toBe(0);
    expect(s.usePetStore.getState().byMonster.nilly.health).toBe(88);
  });

  it("a fresh install has no milestones owed and pays nothing", async () => {
    const s = coldStart();
    const stop = s.subscribeUnsettledMilestoneRecovery();
    mockResolvers["mm-store-owned"](null);
    mockResolvers["mm-pet"](null);
    mockResolvers["mm-player"](null);
    await flushHydration();
    expect(s.usePetStore.getState().byMonster.nilly.claimedMilestones).toEqual(
      [],
    );
    expect(s.usePetStore.getState().unsettledMilestones).toEqual([]);
    // Just the welcome gift.
    expect(s.usePlayerStore.getState().totalPoints).toBe(100);
    stop();
  });
});
