/**
 * The stat panel's collapsed/expanded choice persists across app sessions.
 * Uses a real in-memory AsyncStorage so a toggle written in one "session"
 * is read back by a fresh store instance in the next (jest.resetModules
 * simulates the app relaunch).
 */

let mockDisk: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockDisk[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockDisk[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockDisk[key];
    return Promise.resolve();
  }),
}));

/** Fresh store module instance, as after an app restart. */
function launchApp() {
  jest.resetModules();
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  return require("@/store/use-player-store");
}

/** Drain the getItem → migrate → merge → setItem promise chain. */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  mockDisk = {};
});

describe("stat panel collapsed-state persistence", () => {
  it("defaults to expanded on a fresh install", async () => {
    const { usePlayerStore } = launchApp();
    await flush();

    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    expect(usePlayerStore.getState().statPanelCollapsed).toBe(false);
  });

  it("toggleStatPanel flips the state both ways", async () => {
    const { usePlayerStore } = launchApp();
    await flush();

    usePlayerStore.getState().toggleStatPanel();
    expect(usePlayerStore.getState().statPanelCollapsed).toBe(true);

    usePlayerStore.getState().toggleStatPanel();
    expect(usePlayerStore.getState().statPanelCollapsed).toBe(false);
  });

  it("a collapse in one session is still collapsed after an app relaunch", async () => {
    // Session 1: hydrate, collapse, let the persist write land on disk.
    const first = launchApp();
    await flush();
    first.usePlayerStore.getState().toggleStatPanel();
    await flush();
    expect(mockDisk["mm-player"]).toContain('"statPanelCollapsed":true');

    // Session 2 (relaunch): fresh module, rehydrates from the same disk.
    const second = launchApp();
    await flush();
    expect(second.usePlayerStore.getState().statPanelCollapsed).toBe(true);

    // And expanding persists the same way for session 3.
    second.usePlayerStore.getState().toggleStatPanel();
    await flush();
    const third = launchApp();
    await flush();
    expect(third.usePlayerStore.getState().statPanelCollapsed).toBe(false);
  });

  it("older persisted versions without the key migrate to expanded", () => {
    const { migratePlayerState } = launchApp();

    const out = migratePlayerState({ totalPoints: 50 }, 3);
    expect(out.statPanelCollapsed).toBe(false);

    // A persisted value always wins over the migration default.
    const kept = migratePlayerState(
      { totalPoints: 50, statPanelCollapsed: true },
      3,
    );
    expect(kept.statPanelCollapsed).toBe(true);
  });
});
