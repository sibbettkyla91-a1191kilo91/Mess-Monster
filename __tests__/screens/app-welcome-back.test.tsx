/**
 * Welcome-back detection on a foreground return. The root layout reads the
 * active monster's lastSessionAt before the existing decay pass runs and, at
 * 4+ hours, flags an in-memory hello for Home. Decay itself is unchanged;
 * nothing is persisted; the flag is spent once and does not come back
 * without a fresh gap.
 */
import { act, render } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";

import RootLayout from "@/app/_layout";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import {
  useSessionStore,
  WELCOME_BACK_THRESHOLD_MS,
} from "@/store/use-session-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

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
  useSessionStore.setState({ pendingWelcome: false, awayMs: 0 });
});

afterEach(() => {
  unmountApp?.();
  unmountApp = undefined;
  jest.restoreAllMocks();
});

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function mountApp() {
  const screen = render(<RootLayout />);
  unmountApp = () => screen.unmount();
  await act(async () => {
    await flushHydration();
  });
  const call = [...appStateSpy.mock.calls]
    .reverse()
    .find(([event]) => event === "change");
  return call![1] as (state: AppStateStatus) => void;
}

const background = (handler: (state: AppStateStatus) => void) =>
  act(() => handler("background"));

const foreground = (handler: (state: AppStateStatus) => void) =>
  act(() => handler("active"));

function fresh(monster: "nilly" | "luna" = "nilly") {
  usePlayerStore.setState({ selectedMonster: monster });
  const now = Date.now();
  const by = usePetStore.getState().byMonster;
  usePetStore.setState({
    byMonster: {
      nilly: {
        ...by.nilly,
        health: 100,
        happiness: 100,
        lastSessionAt: now,
        lastCaredAt: now,
      },
      luna: {
        ...by.luna,
        health: 100,
        happiness: 100,
        lastSessionAt: now,
        lastCaredAt: now,
      },
    },
  });
}

describe("welcome-back on foreground return", () => {
  it("a fresh install never greets: hydration with nothing saved leaves the flag off", async () => {
    await mountApp();
    expect(useSessionStore.getState().pendingWelcome).toBe(false);
  });

  it("flags a hello after 5 hours away, and decay still lands exactly as before", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 8, 0, 0));
    const handler = await mountApp();
    fresh();

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 27, 13, 0, 0)); // 5 h
    foreground(handler);

    const session = useSessionStore.getState();
    expect(session.pendingWelcome).toBe(true);
    expect(session.awayMs).toBe(5 * 3_600_000);
    // The existing rates: 1.5 health/h and 2.0 happiness/h — untouched.
    const { health, happiness, lastSessionAt } = usePetStore.getState();
    expect(health).toBeCloseTo(92.5, 1);
    expect(happiness).toBeCloseTo(90, 1);
    expect(lastSessionAt).toBe(Date.now());
  });

  it("stays quiet after a 20-minute break", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 8, 0, 0));
    const handler = await mountApp();
    fresh();

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 27, 8, 20, 0));
    foreground(handler);

    expect(useSessionStore.getState().pendingWelcome).toBe(false);
    expect(useSessionStore.getState().awayMs).toBe(0);
  });

  it("uses exactly the 4-hour threshold", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 8, 0, 0));
    const handler = await mountApp();
    fresh();

    background(handler);
    jest.setSystemTime(Date.now() + WELCOME_BACK_THRESHOLD_MS - 1);
    foreground(handler);
    expect(useSessionStore.getState().pendingWelcome).toBe(false);

    background(handler);
    jest.setSystemTime(Date.now() + WELCOME_BACK_THRESHOLD_MS);
    foreground(handler);
    expect(useSessionStore.getState().pendingWelcome).toBe(true);
  });

  it("is spent once: consuming it, then returning without a new gap, shows nothing", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 8, 0, 0));
    const handler = await mountApp();
    fresh();

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 27, 14, 0, 0)); // 6 h
    foreground(handler);
    expect(useSessionStore.getState().pendingWelcome).toBe(true);

    act(() => useSessionStore.getState().consumeWelcome());
    expect(useSessionStore.getState().pendingWelcome).toBe(false);

    // Decay stamped lastSessionAt to now, so a quick app switch is no gap.
    background(handler);
    jest.setSystemTime(new Date(2026, 4, 27, 14, 5, 0));
    foreground(handler);
    expect(useSessionStore.getState().pendingWelcome).toBe(false);
  });

  it("reads the ACTIVE monster's gap: Luna selected, only Nilly stale → no hello", async () => {
    jest.setSystemTime(new Date(2026, 4, 27, 8, 0, 0));
    const handler = await mountApp();
    fresh("luna");
    const by = usePetStore.getState().byMonster;
    usePetStore.setState({
      byMonster: {
        ...by,
        nilly: { ...by.nilly, lastSessionAt: Date.now() - 10 * 3_600_000 },
      },
    });

    background(handler);
    jest.setSystemTime(new Date(2026, 4, 27, 8, 10, 0));
    foreground(handler);

    expect(useSessionStore.getState().pendingWelcome).toBe(false);
  });

  it("never persists anything: the session store has no storage", () => {
    expect(
      (useSessionStore as unknown as { persist?: unknown }).persist,
    ).toBeUndefined();
  });
});
