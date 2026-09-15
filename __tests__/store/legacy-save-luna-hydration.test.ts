/**
 * A player who chose Luna before per-monster state existed (pre "Feed, Play,
 * and Pet care, with a bag per monster") comes back to *Luna's* pet and bag.
 *
 * The migration stages the shared blob on Nilly, because the pet and shop
 * stores cannot know who was selected until the player store has hydrated —
 * and the three stores hydrate in no guaranteed order. These tests drive the
 * real persist chain for all three stores with the old shapes on "disk", in
 * both orders, and check the staged data ends up on Luna, Nilly is a fresh
 * egg with an empty bag, and Feed then eats from Luna's bag.
 */
type Resolvers = Record<string, (value: string | null) => void>;
type Holder = typeof globalThis & { __mmLegacyResolvers?: Resolvers };

const holder = globalThis as Holder;
holder.__mmLegacyResolvers ??= {};

jest.mock("@react-native-async-storage/async-storage", () => {
  const h = globalThis as Holder;
  h.__mmLegacyResolvers ??= {};
  const resolvers = h.__mmLegacyResolvers;
  return {
    getItem: jest.fn(
      (key: string) =>
        new Promise((resolve) => {
          resolvers[key] = resolve;
        }),
    ),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
function coldStart() {
  jest.resetModules();
  holder.__mmLegacyResolvers = {};
  const { usePlayerStore } = require("@/store/use-player-store");
  const { usePetStore } = require("@/store/use-pet-store");
  const { useStoreStore } = require("@/store/use-store-store");
  const { executeFeed } = require("@/store/recover-unsettled-feeds");
  const { localDayString } = require("@/utils/local-day");
  const { LEGACY_ITEMS } = require("../fixtures/legacy-catalog");
  return {
    usePlayerStore,
    usePetStore,
    useStoreStore,
    executeFeed,
    today: localDayString() as string,
    // A v3 save carries snapshots from the retired catalog.
    item: (id: string) => LEGACY_ITEMS[id],
  };
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** Drain persist's promise chain, then the stores' setImmediate follow-ups. */
async function settle() {
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    await new Promise<void>((r) => setImmediate(r));
  }
}

async function resolveKey(key: string, value: string) {
  holder.__mmLegacyResolvers![key]!(value);
  await settle();
}

const NOW = Date.now();
// Recent enough that decay on hydrate is below its ~36 s floor and skipped.
const A_MOMENT_AGO = NOW - 10_000;

function legacyPlayerSave(today: string) {
  return JSON.stringify({
    state: {
      totalPoints: 340,
      spentPoints: 60,
      streak: 4,
      lastActiveDay: today,
      activeDaysCount: 9,
      isPremium: false,
      selectedMonster: "luna",
      monsterName: "Mistletoe",
      hasCompletedOnboarding: true,
      lastTapReactionDate: today,
      tapReactionCount: 3,
      notifPermissionAsked: true,
      statPanelCollapsed: false,
      appliedRewardGrants: {},
      appliedPurchases: {},
    },
    version: 5,
  });
}

const LEGACY_PET_SAVE = JSON.stringify({
  state: {
    health: 62,
    happiness: 48,
    lastCaredAt: A_MOMENT_AGO,
    lastSessionAt: A_MOMENT_AGO,
    evolutionStage: "teen",
    totalPointsEarned: 280,
    adultVariant: "base",
    categoryCompletions: { kitchen: 5, bathroom: 2 },
    pendingEvolution: null,
    pendingPremiumGate: null,
    premiumGateShownFor: null,
    claimedStreakMilestones: [3],
    pendingMilestoneBanner: null,
    appliedRewardGrants: { "2026-09-01:wash-dishes": { care: true } },
    appliedPurchases: {},
  },
  version: 3,
});

function legacyStoreSave(item: (id: string) => unknown) {
  const entry = (id: string, quantity: number) => ({
    item: item(id),
    quantity,
    purchasedAt: A_MOMENT_AGO,
  });
  return JSON.stringify({
    state: {
      owned: {
        "food-cookie": entry("food-cookie", 2),
        "toy-yarn": entry("toy-yarn", 1),
        "decor-plant": entry("decor-plant", 1),
      },
      placed: { "decor-plant": true },
      equipped: {},
      unsettledPurchases: [],
      appliedPurchases: {},
      appliedRewardGrants: {},
    },
    version: 3,
  });
}

function expectLunaOwnsEverything(stores: ReturnType<typeof coldStart>) {
  const { usePlayerStore, usePetStore, useStoreStore, today } = stores;
  expect(usePlayerStore.persist.hasHydrated()).toBe(true);
  expect(usePetStore.persist.hasHydrated()).toBe(true);
  expect(useStoreStore.persist.hasHydrated()).toBe(true);

  const pet = usePetStore.getState();
  expect(pet.byMonster.luna.evolutionStage).toBe("teen");
  expect(pet.byMonster.luna.totalPointsEarned).toBe(280);
  expect(pet.byMonster.luna.health).toBe(62);
  expect(pet.byMonster.luna.happiness).toBe(48);
  expect(pet.byMonster.luna.categoryCompletions).toEqual({
    kitchen: 5,
    bathroom: 2,
  });
  expect(pet.byMonster.nilly.evolutionStage).toBe("egg");
  expect(pet.byMonster.nilly.totalPointsEarned).toBe(0);
  expect(pet.byMonster.nilly.health).toBe(100);
  expect(pet.legacySharedPet).toBeNull();
  // Flat mirrors show the selected monster — the one Home reads.
  expect(pet.evolutionStage).toBe("teen");
  expect(pet.health).toBe(62);
  // Store-wide records survive untouched.
  expect(pet.claimedStreakMilestones).toEqual([3]);
  expect(pet.appliedRewardGrants["2026-09-01:wash-dishes"]).toEqual({
    care: true,
  });

  const shop = useStoreStore.getState();
  expect(shop.byMonster.luna.owned["food-cookie"].quantity).toBe(2);
  expect(shop.byMonster.luna.owned["toy-yarn"].quantity).toBe(1);
  expect(shop.byMonster.luna.placed).toEqual({ "decor-plant": true });
  expect(shop.byMonster.nilly.owned).toEqual({});
  expect(shop.byMonster.nilly.placed).toEqual({});
  expect(shop.legacySharedInventory).toBeNull();
  expect(shop.owned["food-cookie"].quantity).toBe(2);
  expect(shop.isOwned("toy-yarn")).toBe(true);

  const player = usePlayerStore.getState();
  expect(player.selectedMonster).toBe("luna");
  expect(player.hasCompletedOnboarding).toBe(true);
  expect(player.totalPoints - player.spentPoints).toBe(280);
  expect(player.tapReactions.luna).toEqual({ date: today, count: 3 });
  expect(player.tapReactions.nilly).toEqual({ date: "", count: 0 });
  expect(player.tapReactionCount).toBe(3);
}

describe("a pre-per-monster save whose player chose Luna", () => {
  it("lands on Luna when the player store hydrates first", async () => {
    const stores = coldStart();
    await resolveKey("mm-player", legacyPlayerSave(stores.today));
    await resolveKey("mm-pet", LEGACY_PET_SAVE);
    await resolveKey("mm-store-owned", legacyStoreSave(stores.item));

    expectLunaOwnsEverything(stores);
  });

  it("lands on Luna when the pet and shop stores hydrate before the player", async () => {
    const stores = coldStart();
    await resolveKey("mm-pet", LEGACY_PET_SAVE);
    await resolveKey("mm-store-owned", legacyStoreSave(stores.item));

    // Staged on Nilly, and held there, until the player store answers.
    expect(stores.usePetStore.getState().legacySharedPet).not.toBeNull();
    expect(stores.usePetStore.getState().byMonster.nilly.evolutionStage).toBe(
      "teen",
    );
    expect(
      stores.useStoreStore.getState().legacySharedInventory,
    ).not.toBeNull();

    await resolveKey("mm-player", legacyPlayerSave(stores.today));

    expectLunaOwnsEverything(stores);
  });

  it("feeds Luna from her migrated bag, leaving Nilly untouched", async () => {
    const stores = coldStart();
    await resolveKey("mm-pet", LEGACY_PET_SAVE);
    await resolveKey("mm-player", legacyPlayerSave(stores.today));
    await resolveKey("mm-store-owned", legacyStoreSave(stores.item));
    expectLunaOwnsEverything(stores);

    expect(stores.executeFeed("food-cookie")).toBe(true);

    const pet = stores.usePetStore.getState();
    expect(pet.byMonster.luna.health).toBe(70);
    expect(pet.byMonster.luna.happiness).toBe(56);
    expect(pet.byMonster.nilly.health).toBe(100);
    expect(pet.byMonster.nilly.happiness).toBe(100);
    const shop = stores.useStoreStore.getState();
    expect(shop.byMonster.luna.owned["food-cookie"].quantity).toBe(1);
    expect(shop.byMonster.nilly.owned["food-cookie"]).toBeUndefined();
    expect(shop.unsettledFeeds).toEqual([]);
  });

  it("still puts the old save on Nilly for a player who chose Nilly", async () => {
    const stores = coldStart();
    await resolveKey("mm-pet", LEGACY_PET_SAVE);
    await resolveKey("mm-store-owned", legacyStoreSave(stores.item));
    const nillySave = JSON.parse(legacyPlayerSave(stores.today));
    nillySave.state.selectedMonster = "nilly";
    await resolveKey("mm-player", JSON.stringify(nillySave));

    const pet = stores.usePetStore.getState();
    expect(pet.byMonster.nilly.evolutionStage).toBe("teen");
    expect(pet.byMonster.nilly.totalPointsEarned).toBe(280);
    expect(pet.byMonster.luna.evolutionStage).toBe("egg");
    expect(pet.legacySharedPet).toBeNull();
    const shop = stores.useStoreStore.getState();
    expect(shop.byMonster.nilly.owned["food-cookie"].quantity).toBe(2);
    expect(shop.byMonster.luna.owned).toEqual({});
    expect(shop.legacySharedInventory).toBeNull();
    expect(stores.usePlayerStore.getState().tapReactions.nilly).toEqual({
      date: stores.today,
      count: 3,
    });
  });
});
