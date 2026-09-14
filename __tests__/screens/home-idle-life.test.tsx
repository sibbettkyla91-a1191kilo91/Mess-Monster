/**
 * Idle life — breathing, glances, perk-up hops, the ground shadow — is pure
 * presentation. A minute of it must not touch a persisted store, unmounting
 * must leave no timers behind, and the OS "reduce motion" setting must park
 * every continuous loop.
 */
import { act, render } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";

import HomeScreen from "@/app/(tabs)/index";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";
import { useTasksStore } from "@/store/use-tasks-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function seedHome(health = 90, happiness = 90) {
  usePlayerStore.setState({
    selectedMonster: "nilly",
    monsterName: "Nilly",
    totalPoints: 100,
    spentPoints: 0,
    lastTapReactionDate: "",
    tapReactionCount: 0,
  });
  usePetStore.setState({
    health,
    happiness,
    lastSessionAt: Date.now(),
    lastCaredAt: Date.now(),
    evolutionStage: "baby",
    pendingEvolution: null,
    pendingPremiumGate: null,
    pendingMilestoneBanner: null,
  });
  useStoreStore.setState({ owned: {}, placed: {}, equipped: {} });
}

// RN's jest preset ships AccessibilityInfo as a shared jest.fn mock; a blanket
// restoreAllMocks would wipe its default implementation for later tests, so
// each test puts back exactly what it changed.
const reduceMotionMock = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;

afterEach(() => {
  reduceMotionMock.mockImplementation(() => Promise.resolve(false));
});

describe("Home idle life", () => {
  it("runs for a minute without a single write to any persisted store", async () => {
    const petSet = jest.spyOn(usePetStore, "setState");
    const playerSet = jest.spyOn(usePlayerStore, "setState");
    const storeSet = jest.spyOn(useStoreStore, "setState");
    const tasksSet = jest.spyOn(useTasksStore, "setState");

    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome()); // thriving: perk-up hops are live too
    act(() => {
      jest.advanceTimersByTime(0);
    });

    petSet.mockClear();
    playerSet.mockClear();
    storeSet.mockClear();
    tasksSet.mockClear();
    const pet = usePetStore.getState();
    const player = usePlayerStore.getState();
    const store = useStoreStore.getState();
    const tasks = useTasksStore.getState();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(petSet).not.toHaveBeenCalled();
    expect(playerSet).not.toHaveBeenCalled();
    expect(storeSet).not.toHaveBeenCalled();
    expect(tasksSet).not.toHaveBeenCalled();
    expect(usePetStore.getState()).toBe(pet);
    expect(usePlayerStore.getState()).toBe(player);
    expect(useStoreStore.getState()).toBe(store);
    expect(useTasksStore.getState()).toBe(tasks);
    expect(screen.getByTestId("monster-ground-shadow")).toBeTruthy();
    screen.unmount();
    petSet.mockRestore();
    playerSet.mockRestore();
    storeSet.mockRestore();
    tasksSet.mockRestore();
  });

  it("clears every timer on unmount", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome());
    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    const live = jest.getTimerCount();
    expect(live).toBeGreaterThan(0);

    screen.unmount();
    const afterUnmount = jest.getTimerCount();
    expect(afterUnmount).toBeLessThan(live);

    // Whatever was mid-flight (a finishing tween frame) drains without
    // rescheduling: nothing keeps ticking once the screen is gone.
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("parks the idle loops when the OS asks for reduced motion", async () => {
    reduceMotionMock.mockImplementation(() => Promise.resolve(true));
    const timing = jest.spyOn(Animated, "timing");

    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome());
    // Let the reduce-motion read land and the effects re-run.
    await act(async () => {
      await flushHydration();
    });
    act(() => {
      jest.advanceTimersByTime(0);
    });

    timing.mockClear();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    // Glance, wiggle, perk-up and pulse each build a fresh tween when they
    // fire; with reduce motion on, none of them fire.
    expect(timing).not.toHaveBeenCalled();
    screen.unmount();
    timing.mockRestore();
  });

  it("keeps the idle loops alive when reduced motion is off (control)", async () => {
    const timing = jest.spyOn(Animated, "timing");

    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome());
    act(() => {
      jest.advanceTimersByTime(0);
    });

    timing.mockClear();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(timing).toHaveBeenCalled();
    screen.unmount();
    timing.mockRestore();
  });
});
