/**
 * A save the app cannot read must never lock the player out.
 *
 * zustand's persist runs getItem → parse → migrate → merge → onRehydrate as
 * one promise chain and only flips hasHydrated() at the end. Every screen
 * gates on hydration, so a single unreadable AsyncStorage value, a throwing
 * migration, or a same-version record with a hole in it used to mean an app
 * that opened to nothing — forever, on every launch. These tests drive each
 * store through those failures and check it still hydrates, on a shape its
 * selectors can run on, with the unreadable blob parked for inspection.
 */

type Resolvers = Record<string, (value: string | null) => void>;
type Holder = typeof globalThis & { __mmCorruptResolvers?: Resolvers };

const holder = globalThis as Holder;
holder.__mmCorruptResolvers ??= {};

jest.mock("@react-native-async-storage/async-storage", () => {
  const h = globalThis as Holder;
  h.__mmCorruptResolvers ??= {};
  const resolvers = h.__mmCorruptResolvers;
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
  holder.__mmCorruptResolvers = {};
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  const { usePlayerStore } = require("@/store/use-player-store");
  const { usePetStore } = require("@/store/use-pet-store");
  const { useStoreStore } = require("@/store/use-store-store");
  const { useTasksStore } = require("@/store/use-tasks-store");
  const { usePhotoStore } = require("@/store/use-photo-store");
  return {
    AsyncStorage,
    usePlayerStore,
    usePetStore,
    useStoreStore,
    useTasksStore,
    usePhotoStore,
  };
}
/* eslint-enable @typescript-eslint/no-require-imports */

async function flushHydration() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

async function resolve(key: string, value: string | null) {
  holder.__mmCorruptResolvers![key]?.(value);
  await flushHydration();
}

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("unreadable AsyncStorage values", () => {
  it("hydrates the player store to defaults from truncated JSON and parks the blob", async () => {
    const { AsyncStorage, usePlayerStore } = coldStart();
    const truncated = '{"state":{"totalPoints":250,"spentPo';

    await resolve("mm-player", truncated);

    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(usePlayerStore.getState().hasCompletedOnboarding).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "mm-player:corrupt",
      truncated,
    );
  });

  it("treats valid JSON that is not a { state } record as a fresh save", async () => {
    const { usePetStore } = coldStart();

    await resolve("mm-pet", JSON.stringify([1, 2, 3]));

    expect(usePetStore.persist.hasHydrated()).toBe(true);
    expect(usePetStore.getState().byMonster.nilly.health).toBe(100);
    expect(usePetStore.getState().byMonster.luna.health).toBe(100);
  });

  it("hydrates when the storage read itself rejects", async () => {
    const { AsyncStorage, useTasksStore } = coldStart();
    AsyncStorage.getItem.mockRejectedValueOnce(new Error("disk unavailable"));
    void useTasksStore.persist.rehydrate();
    await flushHydration();

    expect(useTasksStore.persist.hasHydrated()).toBe(true);
    expect(useTasksStore.getState().dailyRoll.length).toBeGreaterThan(0);
  });

  it("does not surface a failed write as an unhandled rejection", async () => {
    const { AsyncStorage, usePhotoStore } = coldStart();
    await resolve("mm-photos", null);
    AsyncStorage.setItem.mockRejectedValueOnce(new Error("disk full"));

    usePhotoStore
      .getState()
      .addPhoto({ taskId: "wash-dishes", photoUri: "file://a", takenAt: 1 });
    await flushHydration();

    expect(usePhotoStore.getState().photos).toHaveLength(1);
  });
});

describe("migrations that cannot be trusted", () => {
  it("hands the raw state on instead of rejecting hydration", () => {
    const { safeMigrate } = require("@/store/safe-persist");
    const boom = safeMigrate("mm-test", () => {
      throw new Error("unexpected shape");
    });
    const raw = { totalPoints: 42 };

    expect(boom(raw, 1)).toBe(raw);
  });

  it("still finishes hydration for an ancient pet save with an impossible stage", async () => {
    const { usePetStore } = coldStart();
    // Version 1 saves stored the stage as an integer; 99 maps to nothing.
    await resolve(
      "mm-pet",
      JSON.stringify({
        state: { health: "full", happiness: 60, evolutionStage: 99 },
        version: 1,
      }),
    );

    expect(usePetStore.persist.hasHydrated()).toBe(true);
    const nilly = usePetStore.getState().byMonster.nilly;
    expect(nilly.evolutionStage).toBe("egg");
    expect(nilly.health).toBe(100);
    expect(nilly.happiness).toBe(60);
  });
});

describe("same-version records with holes", () => {
  it("pet: restores a missing monster, clamps and de-NaNs stats, drops unknown enums", async () => {
    const { usePetStore } = coldStart();
    await resolve(
      "mm-pet",
      JSON.stringify({
        state: {
          byMonster: {
            nilly: {
              health: NaN,
              happiness: 140,
              evolutionStage: "dragon",
              totalPointsEarned: -5,
              adultVariant: "garage",
              categoryCompletions: { kitchen: 3, bathroom: "lots" },
              pendingEvolution: "adult",
              pendingPremiumGate: "nowhere",
            },
          },
          claimedStreakMilestones: [3, "seven", 14],
          pendingMilestoneBanner: "7",
          appliedFeeds: "none",
        },
        version: 4,
      }),
    );

    expect(usePetStore.persist.hasHydrated()).toBe(true);
    const { nilly, luna } = usePetStore.getState().byMonster;
    expect(nilly.health).toBe(100);
    expect(nilly.happiness).toBe(100);
    expect(nilly.evolutionStage).toBe("egg");
    expect(nilly.totalPointsEarned).toBe(0);
    expect(nilly.adultVariant).toBe("base");
    expect(nilly.categoryCompletions).toEqual({ kitchen: 3 });
    expect(nilly.pendingEvolution).toBe("adult");
    expect(nilly.pendingPremiumGate).toBeNull();
    expect(luna).toBeDefined();
    expect(luna.health).toBe(100);
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([3, 14]);
    expect(usePetStore.getState().pendingMilestoneBanner).toBeNull();
    expect(usePetStore.getState().appliedFeeds).toEqual({});
  });

  it("inventory: fixes quantities, refreshes snapshots, and drops dangling placements", async () => {
    const { useStoreStore } = coldStart();
    await resolve(
      "mm-store-owned",
      JSON.stringify({
        state: {
          byMonster: {
            nilly: {
              owned: {
                "food-cookie": {
                  item: { id: "food-cookie", name: "Old Cookie", price: 1 },
                  quantity: -3,
                  purchasedAt: "yesterday",
                },
                "toy-yarn": {
                  item: { id: "toy-yarn", name: "Yarn" },
                  quantity: 1.7,
                },
                "decor-plant": {
                  item: { id: "decor-plant", name: "Plant" },
                  quantity: 1,
                },
                "acc-bow": {
                  item: { id: "acc-bow", name: "Bow" },
                  quantity: 0,
                },
                junk: 42,
                "retired-item": {
                  item: { id: "retired-item", name: "Retired" },
                  quantity: 1,
                },
              },
              placed: {
                "decor-plant": true,
                "toy-yarn": true,
                "acc-bow": true,
                ghost: true,
              },
              equipped: { head: "acc-bow", tail: "toy-yarn", face: 7 },
            },
          },
          unsettledPurchases: [
            { id: "p1", itemId: "food-cookie", price: 10, autoConsume: false },
            { id: "p2", price: 10 },
            "nonsense",
          ],
          unsettledFeeds: [
            { id: "f1", itemId: "food-cookie", monsterId: "luna" },
            { id: "f2", itemId: "food-cookie", monsterId: "dracula" },
          ],
        },
        version: 4,
      }),
    );

    expect(useStoreStore.persist.hasHydrated()).toBe(true);
    const s = useStoreStore.getState();
    const nilly = s.byMonster.nilly;
    expect(nilly.owned["food-cookie"].quantity).toBe(0);
    expect(nilly.owned["food-cookie"].item.name).not.toBe("Old Cookie");
    expect(Number.isFinite(nilly.owned["food-cookie"].purchasedAt)).toBe(true);
    expect(nilly.owned["toy-yarn"].quantity).toBe(1);
    // Catalog snapshot restored — the Collection filters on it.
    expect(nilly.owned["toy-yarn"].item.category).toBe("toys");
    expect(nilly.owned.junk).toBeUndefined();
    // An id the catalog no longer sells keeps its snapshot.
    expect(nilly.owned["retired-item"].item.name).toBe("Retired");
    expect(nilly.placed).toEqual({ "decor-plant": true, "toy-yarn": true });
    expect(nilly.equipped).toEqual({});
    expect(s.byMonster.luna.owned).toEqual({});
    expect(s.unsettledPurchases).toEqual([
      { id: "p1", itemId: "food-cookie", price: 10, autoConsume: false },
    ]);
    expect(s.unsettledFeeds).toEqual([
      { id: "f1", itemId: "food-cookie", monsterId: "luna" },
    ]);
    // Flat mirrors track the sanitized slice.
    expect(s.owned["toy-yarn"].quantity).toBe(1);
  });

  it("player: keeps the balance finite and non-negative and the monster a real id", async () => {
    const { usePlayerStore } = coldStart();
    await resolve(
      "mm-player",
      JSON.stringify({
        state: {
          totalPoints: 50,
          spentPoints: 80,
          streak: -2,
          selectedMonster: "dracula",
          monsterName: 12,
          hasCompletedOnboarding: true,
          tapReactions: { nilly: { date: "2026-09-14", count: "3" } },
        },
        version: 6,
      }),
    );

    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    const s = usePlayerStore.getState();
    expect(s.totalPoints).toBe(50);
    expect(s.spentPoints).toBe(50);
    expect(s.totalPoints - s.spentPoints).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.selectedMonster).toBeNull();
    expect(s.monsterName).toBe("");
    expect(s.tapReactions.nilly).toEqual({ date: "2026-09-14", count: 0 });
    expect(s.tapReactions.luna).toEqual({ date: "", count: 0 });
    expect(s.lastTapReactionDate).toBe("2026-09-14");
  });

  it("player: a save that chose a monster before the onboarding flag existed counts as onboarded", async () => {
    const { usePlayerStore } = coldStart();
    await resolve(
      "mm-player",
      JSON.stringify({
        state: {
          totalPoints: 100,
          spentPoints: 0,
          streak: 0,
          lastActiveDay: "",
          selectedMonster: "luna",
        },
        version: 1,
      }),
    );

    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    expect(usePlayerStore.getState().selectedMonster).toBe("luna");
    expect(usePlayerStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it("player: a save with no monster is still sent through onboarding", async () => {
    const { usePlayerStore } = coldStart();
    await resolve(
      "mm-player",
      JSON.stringify({
        state: { totalPoints: 100, spentPoints: 0 },
        version: 1,
      }),
    );

    expect(usePlayerStore.getState().hasCompletedOnboarding).toBe(false);
  });

  it("tasks: regenerates an unreadable roll for its date and resets garbage progress", async () => {
    const { useTasksStore } = coldStart();
    const { localDayString } = require("@/utils/local-day");
    const today = localDayString();
    await resolve(
      "mm-tasks",
      JSON.stringify({
        state: {
          tasks: [
            { id: "x" },
            {
              id: "wash-dishes",
              label: "Wash",
              category: "kitchen",
              pointValue: 20,
              completedAt: 1,
            },
          ],
          dailyRoll: "six chores",
          dailyRollDate: today,
          taskProgress: {
            "wash-dishes": {
              state: "teleporting",
              hasPhoto: "yes",
              waitStartedAt: "now",
            },
            "make-bed": null,
          },
          pendingRewards: [{ id: "r1" }],
          unsettledGrants: {},
        },
        version: 3,
      }),
    );

    expect(useTasksStore.persist.hasHydrated()).toBe(true);
    const s = useTasksStore.getState();
    expect(s.dailyRollDate).toBe(today);
    expect(s.dailyRoll.length).toBeGreaterThan(0);
    expect(s.tasks).toHaveLength(1);
    expect(s.taskProgress["wash-dishes"]).toEqual({
      state: "idle",
      hasPhoto: false,
    });
    expect(s.taskProgress["make-bed"]).toBeUndefined();
    expect(s.pendingRewards).toEqual([]);
    expect(s.unsettledGrants).toEqual([]);
  });

  it("photos: keeps only well-formed records", async () => {
    const { usePhotoStore } = coldStart();
    await resolve(
      "mm-photos",
      JSON.stringify({
        state: {
          photos: [
            { taskId: "wash-dishes", photoUri: "file://ok", takenAt: 5 },
            { taskId: "wash-dishes", photoUri: null, takenAt: 5 },
            "garbage",
          ],
        },
        version: 0,
      }),
    );

    expect(usePhotoStore.persist.hasHydrated()).toBe(true);
    expect(usePhotoStore.getState().photos).toEqual([
      { taskId: "wash-dishes", photoUri: "file://ok", takenAt: 5 },
    ]);
  });
});
