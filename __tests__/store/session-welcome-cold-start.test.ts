/**
 * Welcome-back on a cold start. The root layout calls initSessionWelcome()
 * at module load, before any store can finish hydrating; it must read the
 * persisted lastSessionAt BEFORE the pet store's own deferred decay pass
 * stamps it to "now", then wait for the player store to say which monster
 * is active. These tests drive the real persist chain with a save on
 * "disk", in both hydration orders, and check that decay still lands, that
 * a shared save mid-migration is skipped, and that a foreground return
 * right after the cold-start hello cannot produce a second one.
 */
type Resolvers = Record<string, (value: string | null) => void>;
type Holder = typeof globalThis & { __mmColdWelcomeResolvers?: Resolvers };

const holder = globalThis as Holder;
holder.__mmColdWelcomeResolvers ??= {};

jest.mock("@react-native-async-storage/async-storage", () => {
  const h = globalThis as Holder;
  h.__mmColdWelcomeResolvers ??= {};
  const resolvers = h.__mmColdWelcomeResolvers;
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
  holder.__mmColdWelcomeResolvers = {};
  const { usePlayerStore } = require("@/store/use-player-store");
  const { usePetStore } = require("@/store/use-pet-store");
  const session = require("@/store/use-session-store");
  // Exactly what app/_layout.tsx does at module load.
  const stop: () => void = session.initSessionWelcome();
  return {
    usePlayerStore,
    usePetStore,
    useSessionStore: session.useSessionStore,
    noteReturnFromLastSession: session.noteReturnFromLastSession as (
      now?: number,
    ) => void,
    stop,
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

async function resolveKey(key: string, value: string | null) {
  holder.__mmColdWelcomeResolvers![key]!(value);
  await settle();
}

const HOUR = 3_600_000;
const NOW = Date.now();

function petSlice(lastSessionAt: number) {
  return {
    health: 80,
    happiness: 80,
    lastCaredAt: lastSessionAt,
    lastSessionAt,
    evolutionStage: "baby",
    totalPointsEarned: 40,
    adultVariant: "base",
    categoryCompletions: {},
    pendingEvolution: null,
    pendingPremiumGate: null,
    premiumGateShownFor: null,
  };
}

/** A current-shape pet save with a chosen lastSessionAt per monster. */
function petSave(lastSession: { nilly: number; luna: number }) {
  return JSON.stringify({
    state: {
      byMonster: {
        nilly: petSlice(lastSession.nilly),
        luna: petSlice(lastSession.luna),
      },
      legacySharedPet: null,
      claimedStreakMilestones: [],
      pendingMilestoneBanner: null,
      appliedRewardGrants: {},
      appliedPurchases: {},
      appliedFeeds: {},
    },
    version: 4,
  });
}

/** A pre-per-monster (v3) save: migrate stages it as legacySharedPet. */
function legacyPetSave(lastSessionAt: number) {
  return JSON.stringify({
    state: {
      ...petSlice(lastSessionAt),
      claimedStreakMilestones: [],
      pendingMilestoneBanner: null,
      appliedRewardGrants: {},
      appliedPurchases: {},
    },
    version: 3,
  });
}

function playerSave(monster: "nilly" | "luna") {
  return JSON.stringify({
    state: {
      totalPoints: 120,
      spentPoints: 20,
      streak: 2,
      selectedMonster: monster,
      monsterName: monster === "luna" ? "Luna" : "Nilly",
      hasCompletedOnboarding: true,
      isPremium: false,
    },
    version: 6,
  });
}

const expectAboutFiveHours = (awayMs: number) => {
  expect(awayMs).toBeGreaterThanOrEqual(5 * HOUR);
  expect(awayMs).toBeLessThan(5 * HOUR + 60_000);
};

describe("welcome-back on a cold start", () => {
  it("pet save first: waits for the player store, then greets for the active monster — and decay still lands", async () => {
    const s = coldStart();
    await resolveKey(
      "mm-pet",
      petSave({ nilly: NOW - 5 * HOUR, luna: NOW - 5 * HOUR }),
    );

    // Pet hydrated, player not: who is active is unknown, so nothing yet.
    expect(s.usePetStore.persist.hasHydrated()).toBe(true);
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);

    await resolveKey("mm-player", playerSave("luna"));

    const session = s.useSessionStore.getState();
    expect(session.pendingWelcome).toBe(true);
    expectAboutFiveHours(session.awayMs);
    // The existing decay pass ran untouched: 1.5 health/h, 2 happiness/h.
    const luna = s.usePetStore.getState().byMonster.luna;
    expect(luna.health).toBeCloseTo(72.5, 0);
    expect(luna.happiness).toBeCloseTo(70, 0);
    expect(luna.lastSessionAt).toBeGreaterThanOrEqual(NOW);
    s.stop();
  });

  it("player save first: the snapshot is read before the deferred decay stamps lastSessionAt", async () => {
    const s = coldStart();
    await resolveKey("mm-player", playerSave("nilly"));
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);

    await resolveKey(
      "mm-pet",
      petSave({ nilly: NOW - 5 * HOUR, luna: NOW - 1_000 }),
    );

    const session = s.useSessionStore.getState();
    expect(session.pendingWelcome).toBe(true);
    expectAboutFiveHours(session.awayMs);
    // Decay has already re-stamped the gap; the hello was measured first.
    const nilly = s.usePetStore.getState().byMonster.nilly;
    expect(nilly.lastSessionAt).toBeGreaterThanOrEqual(NOW);
    expect(nilly.health).toBeCloseTo(72.5, 0);
    s.stop();
  });

  it("reads only the active monster: Luna selected, Nilly stale, Luna fresh → quiet", async () => {
    const s = coldStart();
    await resolveKey(
      "mm-pet",
      petSave({ nilly: NOW - 10 * HOUR, luna: NOW - 1_000 }),
    );
    await resolveKey("mm-player", playerSave("luna"));

    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);
    expect(s.useSessionStore.getState().awayMs).toBe(0);
    s.stop();
  });

  it("stays quiet under four hours", async () => {
    const s = coldStart();
    await resolveKey("mm-player", playerSave("nilly"));
    await resolveKey(
      "mm-pet",
      petSave({ nilly: NOW - 3 * HOUR, luna: NOW - 3 * HOUR }),
    );

    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);
    s.stop();
  });

  it("a fresh install (nothing saved) never greets", async () => {
    const s = coldStart();
    await resolveKey("mm-player", null);
    await resolveKey("mm-pet", null);

    expect(s.usePetStore.persist.hasHydrated()).toBe(true);
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);
    s.stop();
  });

  it("skips a shared save that is still migrating, even after it lands on Luna", async () => {
    const s = coldStart();
    await resolveKey("mm-pet", legacyPetSave(NOW - 6 * HOUR));
    // Staged on Nilly and flagged as shared until the player store answers.
    expect(s.usePetStore.getState().legacySharedPet).not.toBeNull();
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);

    await resolveKey("mm-player", playerSave("luna"));

    // Migration finished (Luna owns the progress, decay applied) — and the
    // hello stayed off rather than guessing which slice "was away".
    const pet = s.usePetStore.getState();
    expect(pet.legacySharedPet).toBeNull();
    expect(pet.byMonster.luna.evolutionStage).toBe("baby");
    expect(pet.byMonster.luna.health).toBeLessThan(80);
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);
    s.stop();
  });

  it("cannot fire twice: a foreground return right after the cold-start hello stays quiet", async () => {
    const s = coldStart();
    await resolveKey("mm-player", playerSave("nilly"));
    await resolveKey(
      "mm-pet",
      petSave({ nilly: NOW - 5 * HOUR, luna: NOW - 5 * HOUR }),
    );
    expect(s.useSessionStore.getState().pendingWelcome).toBe(true);

    // Home spends the flag…
    s.useSessionStore.getState().consumeWelcome();
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);

    // …and an early AppState "active" runs the foreground path. Decay has
    // already stamped lastSessionAt, so there is no gap left to greet.
    s.noteReturnFromLastSession();
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);
    expect(s.useSessionStore.getState().awayMs).toBe(0);
    s.stop();
  });

  it("noteReturn is idempotent while pending: hydration and an early foreground both flag, Home still sees one hello", async () => {
    const s = coldStart();
    await resolveKey("mm-player", playerSave("nilly"));
    await resolveKey(
      "mm-pet",
      petSave({ nilly: NOW - 5 * HOUR, luna: NOW - 5 * HOUR }),
    );
    const before = s.useSessionStore.getState();
    expect(before.pendingWelcome).toBe(true);

    // A second flag before Home has consumed the first is the same hello.
    s.useSessionStore.getState().noteReturn(7 * HOUR);
    expect(s.useSessionStore.getState().pendingWelcome).toBe(true);
    s.useSessionStore.getState().consumeWelcome();
    expect(s.useSessionStore.getState().pendingWelcome).toBe(false);
    s.stop();
  });
});
