/**
 * Cold-start hydration race for the onboarding flow (selectMonster /
 * setMonsterName / completeOnboarding), mirroring store-hydration.test.ts.
 *
 * NOTE: onboarding already carried its own hydration gate (it renders null
 * until usePlayerStore rehydrates, now via the shared useHasHydrated hook),
 * so the race was never reachable through the UI. These tests pin down why
 * that gate must stay: without it, a monster choice made pre-hydration
 * would silently vanish.
 */

// Deferred AsyncStorage keyed by persist name — see tasks-hydration.test.ts.
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

// A player who installed, backgrounded before finishing onboarding, and
// cold-started again: persisted save exists but onboarding is incomplete.
const PLAYER_SAVE = JSON.stringify({
  state: {
    selectedMonster: null,
    monsterName: "",
    hasCompletedOnboarding: false,
  },
  version: 4,
});

/** Fresh store instance whose rehydration is still in flight. */
function coldStart() {
  jest.resetModules();
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { usePlayerStore } = require("@/store/use-player-store");
  return { usePlayerStore };
}

/** Drain the getItem → migrate → merge → setItem promise chain. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// Mirrors OnboardingScreen's choose().
function choose(usePlayerStore: any) {
  usePlayerStore.getState().selectMonster("luna");
  usePlayerStore.getState().setMonsterName("Mistletoe");
  usePlayerStore.getState().completeOnboarding();
}

describe("onboarding cold-start hydration race", () => {
  it("would clobber a monster choice made before rehydration completes (why the gate exists)", async () => {
    const { usePlayerStore } = coldStart();

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);

    choose(usePlayerStore);
    expect(usePlayerStore.getState().selectedMonster).toBe("luna");
    expect(usePlayerStore.getState().hasCompletedOnboarding).toBe(true);

    mockResolvers["mm-player"](PLAYER_SAVE);
    await flushHydration();

    // Choice, name, and completion flag all erased — the player would be
    // dumped back into onboarding as if they never chose.
    expect(usePlayerStore.getState().selectedMonster).toBeNull();
    expect(usePlayerStore.getState().monsterName).toBe("");
    expect(usePlayerStore.getState().hasCompletedOnboarding).toBe(false);
  });

  it("the screen's gate (render null until hydrated) makes the choice unreachable pre-hydration, and a post-hydration choice sticks", async () => {
    const { usePlayerStore } = coldStart();

    // Mirrors the screen: `if (!hydrated) return null` — no slides, no
    // choose() reachable.
    const screenInteractive = () => usePlayerStore.persist.hasHydrated();

    expect(screenInteractive()).toBe(false);

    mockResolvers["mm-player"](PLAYER_SAVE);
    await flushHydration();

    expect(screenInteractive()).toBe(true);
    choose(usePlayerStore);

    // Downstream reads: the root redirect condition and Home tab name/monster.
    expect(usePlayerStore.getState().hasCompletedOnboarding).toBe(true);
    expect(usePlayerStore.getState().selectedMonster).toBe("luna");
    expect(usePlayerStore.getState().monsterName).toBe("Mistletoe");
  });
});
