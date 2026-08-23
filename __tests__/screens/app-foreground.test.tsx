/**
 * Time keeps passing while the app sits in the background: stats decay and the
 * calendar day can roll over. Cold start catches up from each store's
 * rehydration; this covers the other way back in.
 *
 * Renders the real root layout, fires a real AppState transition back to
 * "active", and asserts the existing pet/tasks store catch-up actions run
 * through that pathway — no reimplementation of decay or the daily roll.
 */
import { act, render } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";

import RootLayout from "@/app/_layout";
import { getDailyRoll } from "@/store/preset-tasks";
import { usePetStore } from "@/store/use-pet-store";
import { useTasksStore } from "@/store/use-tasks-store";
import { localDayString } from "@/utils/local-day";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// The layout's navigation shell is irrelevant here — only its lifecycle is.
jest.mock("expo-router", () => {
  function Stack() {
    return null;
  }
  Stack.Screen = function StackScreen() {
    return null;
  };
  return { Stack };
});

jest.mock("expo-status-bar", () => ({
  StatusBar: function StatusBar() {
    return null;
  },
}));

jest.mock("@/utils/daily-nudge", () => ({
  initNotifications: jest.fn().mockResolvedValue(undefined),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers();

let appStateSpy: jest.SpyInstance;
let unmountApp: (() => void) | undefined;

beforeEach(() => {
  appStateSpy = jest.spyOn(AppState, "addEventListener");
});

afterEach(() => {
  unmountApp?.();
  unmountApp = undefined;
  jest.restoreAllMocks();
});

/** Let store hydration (microtasks) and the deferred decay pass settle. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Mount the app root and hand back its registered AppState listener. */
async function mountApp() {
  const screen = render(<RootLayout />);
  unmountApp = () => screen.unmount();
  await act(async () => {
    await flushHydration();
  });
  // Strict Mode remounts once; the last listener is the live one.
  const call = [...appStateSpy.mock.calls]
    .reverse()
    .find(([event]) => event === "change");
  return call![1] as (state: AppStateStatus) => void;
}

const background = (handler: (state: AppStateStatus) => void) =>
  act(() => handler("background"));

const foreground = (handler: (state: AppStateStatus) => void) =>
  act(() => handler("active"));

describe("app returning to the foreground", () => {
  it("applies the existing decay for time spent backgrounded", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    const handler = await mountApp();
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: Date.now(),
      lastCaredAt: Date.now(),
    });

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 27, 14, 0, 0)); // 2 h away
    foreground(handler);

    const { health, happiness, lastSessionAt } = usePetStore.getState();
    // The existing rates: 1.5 health/h and 2.0 happiness/h.
    expect(health).toBeCloseTo(97, 0);
    expect(happiness).toBeCloseTo(96, 0);
    expect(lastSessionAt).toBe(Date.now());
  });

  it("also catches up after an iOS inactive → active transition", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    const handler = await mountApp();
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: Date.now(),
      lastCaredAt: Date.now(),
    });

    act(() => handler("inactive"));
    jest.setSystemTime(new Date(2026, 4, 27, 14, 0, 0));
    foreground(handler);

    expect(usePetStore.getState().health).toBeCloseTo(97, 0);
    expect(usePetStore.getState().happiness).toBeCloseTo(96, 0);
  });

  it("does not decay on the way out, only on the way back in", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    const handler = await mountApp();
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: Date.now(),
      lastCaredAt: Date.now(),
    });

    jest.setSystemTime(new Date(2026, 4, 27, 14, 0, 0));
    background(handler);

    expect(usePetStore.getState().health).toBe(100);
    expect(usePetStore.getState().happiness).toBe(100);
  });

  it("does not re-apply startup decay when launched already active", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    const handler = await mountApp();
    await act(async () => {
      await flushHydration();
    });
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: Date.now() - 2 * 3_600_000,
      lastCaredAt: Date.now() - 2 * 3_600_000,
    });
    const applyDecay = jest.spyOn(usePetStore.getState(), "applyDecay");

    // Cold start (or a duplicate "active" with no background in between)
    // must not replay the window rehydration already caught up.
    foreground(handler);

    expect(applyDecay).not.toHaveBeenCalled();
    expect(usePetStore.getState().health).toBe(100);
    expect(usePetStore.getState().happiness).toBe(100);
  });

  it("runs the catch-up once per foreground transition", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    const handler = await mountApp();
    const applyDecay = jest.spyOn(usePetStore.getState(), "applyDecay");
    const refreshDailyRoll = jest.spyOn(
      useTasksStore.getState(),
      "refreshDailyRoll",
    );

    background(handler);
    foreground(handler);

    expect(applyDecay).toHaveBeenCalledTimes(1);
    expect(refreshDailyRoll).toHaveBeenCalledTimes(1);

    // Already active: not a new transition, so no second catch-up.
    foreground(handler);
    expect(applyDecay).toHaveBeenCalledTimes(1);
    expect(refreshDailyRoll).toHaveBeenCalledTimes(1);
  });

  it("leaves a valid same-day roll alone", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 10, 0, 0));
    const handler = await mountApp();
    const today = localDayString();
    useTasksStore.setState({
      dailyRollDate: today,
      dailyRoll: getDailyRoll(today),
    });
    const rollBefore = useTasksStore.getState().dailyRoll;

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 27, 10, 5, 0)); // a quick app switch
    foreground(handler);

    expect(useTasksStore.getState().dailyRollDate).toBe(today);
    // Same array instance: the existing refresh recognised it as still valid.
    expect(useTasksStore.getState().dailyRoll).toBe(rollBefore);
  });

  it("recognises the new local day when foregrounded after midnight", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 23, 55, 0));
    const handler = await mountApp();
    const startDay = localDayString();
    useTasksStore.setState({
      dailyRollDate: startDay,
      dailyRoll: getDailyRoll(startDay),
      taskProgress: {},
    });

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 28, 0, 10, 0));
    foreground(handler);

    const s = useTasksStore.getState();
    expect(localDayString()).not.toBe(startDay); // the day really did move
    expect(s.dailyRollDate).toBe(localDayString());
    expect(s.dailyRoll.map((t) => t.id)).toEqual(
      getDailyRoll(localDayString()).map((t) => t.id),
    );
  });

  it("keeps a waiting time lock that crossed midnight in the background", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 23, 55, 0));
    const handler = await mountApp();
    const startDay = localDayString();
    const waitStartedAt = Date.now();
    useTasksStore.setState({
      dailyRollDate: startDay,
      dailyRoll: getDailyRoll(startDay),
      taskProgress: {
        "wash-dishes": { state: "waiting", hasPhoto: false, waitStartedAt },
      },
    });

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 28, 0, 10, 0));
    foreground(handler);

    const s = useTasksStore.getState();
    expect(s.dailyRollDate).toBe(localDayString());
    // The lock survives the foreground rollover, still on its original anchor.
    expect(s.taskProgress["wash-dishes"]).toEqual({
      state: "waiting",
      hasPhoto: false,
      waitStartedAt,
    });
    expect(s.dailyRoll.map((t) => t.id)).toContain("wash-dishes");
  });

  it("removes its foreground listener on unmount", async () => {
    const remove = jest.fn();
    appStateSpy.mockReturnValue({ remove } as never);

    const screen = render(<RootLayout />);
    await act(async () => {
      await flushHydration();
    });
    screen.unmount();

    expect(remove).toHaveBeenCalled();
  });
});
