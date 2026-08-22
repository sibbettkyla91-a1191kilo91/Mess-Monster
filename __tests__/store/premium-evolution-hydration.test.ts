/**
 * Adult evolution is premium-gated, and the check straddles both persisted
 * stores: the stage and lifetime points live in the pet store, while
 * isPremium and activeDaysCount live in the player store. They rehydrate
 * independently, and recheckEvolution otherwise only ever runs from the Home
 * upgrade button.
 *
 * So a premium player who force-quit between unlocking and evolving comes back
 * with isPremium true, stage teen, and premiumGateShownFor already "adult" —
 * no gate left to tap and nothing to re-run the check. These tests pin down
 * the post-hydration recheck that unsticks them, and that it stays a no-op for
 * everyone else.
 */

// Deferred AsyncStorage keyed by persist name, so each store's hydration stays
// in flight until the test resolves that key — see tasks-hydration.test.ts.
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
}));

/**
 * A teen sitting past the adult thresholds (500 points, 14 days) whose premium
 * gate was already shown — the force-quit-mid-upgrade save.
 */
const petSave = () =>
  JSON.stringify({
    state: {
      health: 100,
      happiness: 100,
      lastCaredAt: Date.now(),
      lastSessionAt: Date.now(),
      evolutionStage: "teen",
      totalPointsEarned: 600,
      adultVariant: "base",
      categoryCompletions: { kitchen: 12, bathroom: 3 },
      claimedStreakMilestones: [],
      pendingMilestoneBanner: null,
      pendingEvolution: null,
      pendingPremiumGate: null,
      premiumGateShownFor: "adult",
    },
    version: 2,
  });

const playerSave = (isPremium: boolean) =>
  JSON.stringify({
    state: {
      totalPoints: 600,
      spentPoints: 0,
      streak: 5,
      lastActiveDay: "",
      activeDaysCount: 20,
      isPremium,
      selectedMonster: "nilly",
      monsterName: "Nilly",
      hasCompletedOnboarding: true,
    },
    version: 4,
  });

/** Fresh store instances whose rehydration is still in flight. */
function coldStart() {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { usePetStore } = require("@/store/use-pet-store");
  const { usePlayerStore } = require("@/store/use-player-store");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { usePetStore, usePlayerStore };
}

/** Drain hydration's promise chain plus the pet store's deferred pass. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("premium evolution recheck after hydration", () => {
  it("does not treat the unhydrated premium default as authoritative", async () => {
    const { usePetStore, usePlayerStore } = coldStart();

    // Only the pet store has landed; the player store is still in flight.
    mockResolvers["mm-pet"](petSave());
    await flushHydration();

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);
    const s = usePetStore.getState();
    // isPremium still reads false from defaults — but that must not be taken
    // as a real answer: no evolution, and no gate raised off a default.
    expect(s.evolutionStage).toBe("teen");
    expect(s.pendingEvolution).toBeNull();
    expect(s.pendingPremiumGate).toBeNull();
  });

  it("evolves the stuck premium player once the player store hydrates", async () => {
    const { usePetStore } = coldStart();

    mockResolvers["mm-pet"](petSave());
    await flushHydration();
    expect(usePetStore.getState().evolutionStage).toBe("teen");

    mockResolvers["mm-player"](playerSave(true));
    await flushHydration();

    const s = usePetStore.getState();
    expect(s.evolutionStage).toBe("adult");
    expect(s.pendingEvolution).toBe("adult");
    expect(s.pendingPremiumGate).toBeNull();
    // The existing rules decided the variant — kitchen leads the completions.
    expect(s.adultVariant).toBe("kitchen");
  });

  it("evolves when the player store hydrated before the pet store", async () => {
    const { usePetStore, usePlayerStore } = coldStart();

    mockResolvers["mm-player"](playerSave(true));
    await flushHydration();
    expect(usePlayerStore.persist.hasHydrated()).toBe(true);

    mockResolvers["mm-pet"](petSave());
    await flushHydration();

    const s = usePetStore.getState();
    expect(s.evolutionStage).toBe("adult");
    expect(s.pendingEvolution).toBe("adult");
  });

  it("leaves a non-premium player exactly where they were", async () => {
    const { usePetStore } = coldStart();
    const recheckEvolution = jest.spyOn(
      usePetStore.getState(),
      "recheckEvolution",
    );

    mockResolvers["mm-pet"](petSave());
    mockResolvers["mm-player"](playerSave(false));
    await flushHydration();

    // No premium-specific recheck merely because hydration finished.
    expect(recheckEvolution).not.toHaveBeenCalled();
    const s = usePetStore.getState();
    expect(s.evolutionStage).toBe("teen");
    expect(s.pendingEvolution).toBeNull();
    expect(s.pendingPremiumGate).toBeNull();
  });

  it("rechecks exactly once per hydration, even though the recheck writes pet state", async () => {
    const { usePetStore } = coldStart();
    const recheckEvolution = jest.spyOn(
      usePetStore.getState(),
      "recheckEvolution",
    );

    mockResolvers["mm-pet"](petSave());
    mockResolvers["mm-player"](playerSave(true));
    await flushHydration();

    // The recheck advanced the stage, and that write did not feed back in.
    expect(usePetStore.getState().evolutionStage).toBe("adult");
    expect(recheckEvolution).toHaveBeenCalledTimes(1);

    // Settling further changes nothing.
    await flushHydration();
    expect(recheckEvolution).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an already-adult premium player", async () => {
    const { usePetStore } = coldStart();

    mockResolvers["mm-pet"](
      JSON.stringify({
        state: {
          ...JSON.parse(petSave()).state,
          evolutionStage: "adult",
          adultVariant: "kitchen",
        },
        version: 2,
      }),
    );
    mockResolvers["mm-player"](playerSave(true));
    await flushHydration();

    const s = usePetStore.getState();
    expect(s.evolutionStage).toBe("adult");
    // No surprise celebration replayed on every launch.
    expect(s.pendingEvolution).toBeNull();
  });
});
