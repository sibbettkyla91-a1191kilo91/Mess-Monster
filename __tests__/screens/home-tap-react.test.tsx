/**
 * Tap-to-react must fire in every mood state — including sad and sick (the
 * UI displays sick as "Sad", so a player's "sad monster" can be either).
 * Renders the real HomeScreen, forces each mood via the pet store, presses
 * the monster Pressable, and asserts the full reaction: haptic fired, a
 * floating heart rendered, happiness bumped by the affection boost, and —
 * critically — zero points granted (tap-to-react is economically neutral).
 */
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import HomeScreen from "@/app/(tabs)/index";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

// Contain Home's looping/random setTimeout animations, but leave the real
// macrotask queue intact so React 19's scheduler and pet afterHydrate run.
jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

// health/happiness pairs chosen to land squarely inside each deriveMood band.
const MOODS = [
  ["thriving", 90, 90],
  ["happy", 60, 60],
  ["neutral", 40, 40],
  ["sad", 25, 25],
  ["sick", 5, 5],
] as const;

/**
 * Persist rehydration is a microtask; pet afterHydrate is a setImmediate.
 * Two real macrotask turns cover both without fake-timer advances.
 */
async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * Wait until the tap-heart commit is in the tree.
 *
 * RNTL waitFor detects fake timers and calls advanceTimersByTime, which
 * would run Home's bob/wiggle animations and can fire the 1200ms heart
 * removal. Poll real setImmediate inside act instead: that is the queue
 * React 19 actually uses, and fake setTimeout stays frozen. Bound by a
 * fixed number of macrotask turns so fake Date.now() cannot hang the wait.
 */
async function waitForHeartCount(
  screen: ReturnType<typeof render>,
  count: number,
) {
  const maxTurns = 20;
  let lastError: unknown;
  for (let i = 0; i < maxTurns; i++) {
    try {
      expect(screen.getAllByText("❤️")).toHaveLength(count);
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise<void>((resolve) => setImmediate(resolve));
      });
    }
  }
  throw lastError;
}

function forceMood(health: number, happiness: number) {
  usePetStore.setState({
    health,
    happiness,
    // Fresh timestamps so the deferred applyDecay pass is a no-op.
    lastSessionAt: Date.now(),
    lastCaredAt: Date.now(),
    evolutionStage: "baby", // baby has a dedicated sad sprite variant
    pendingEvolution: null,
    pendingPremiumGate: null,
    pendingMilestoneBanner: null,
  });
  usePlayerStore.setState({
    selectedMonster: "nilly",
    monsterName: "Nilly",
    totalPoints: 100,
    spentPoints: 0,
    lastTapReactionDate: "",
    tapReactionCount: 0,
  });
}

describe("tap-to-react across mood states", () => {
  beforeEach(() => {
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it.each(MOODS)(
    "fires haptic + heart + happiness boost in %s mood, granting no points",
    async (_mood, health, happiness) => {
      const screen = render(<HomeScreen />);
      // Set mood only after hydration settles so the merge can't clobber it.
      await act(async () => {
        await flushHydration();
      });
      act(() => forceMood(health, happiness));

      // The Health StatBar icon is also "❤️" — count the delta, not the total.
      const heartsBefore = screen.getAllByText("❤️").length;

      fireEvent.press(screen.getByLabelText("Care for Nilly"));
      fireEvent.press(screen.getByLabelText("Pet Nilly"));

      // Haptic fired (the bounce animation starts on the same code path,
      // bracketed by the haptic above it and the happiness boost below it).
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      // One new floating heart rendered.
      await waitForHeartCount(screen, heartsBefore + 1);

      // Affection boost applied, capped at 100.
      expect(usePetStore.getState().happiness).toBe(
        Math.min(100, happiness + 3),
      );

      // Economically neutral: no points earned or spent, in any mood.
      expect(usePlayerStore.getState().totalPoints).toBe(100);
      expect(usePlayerStore.getState().spentPoints).toBe(0);

      // The daily tap allowance was consumed — the handler really ran.
      expect(usePlayerStore.getState().tapReactionCount).toBe(1);
    },
  );

  it("keeps reacting on a sad monster after the daily allowance is exhausted (the reported repro), capping only the happiness grant", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    // Reported sequence: taps spent while the monster was in other moods…
    act(() => forceMood(60, 60)); // happy
    const monster = screen.getByLabelText("Care for Nilly");
    let hearts = screen.getAllByText("❤️").length;
    for (let i = 0; i < 5; i++) {
      fireEvent.press(monster);
      fireEvent.press(screen.getByLabelText("Pet Nilly"));
      hearts += 1;
      await waitForHeartCount(screen, hearts);
    }
    expect(usePlayerStore.getState().tapReactionCount).toBe(5);
    expect(usePetStore.getState().happiness).toBe(75); // 5 × +3 granted

    // …then the monster turns sad and gets a comfort tap.
    act(() =>
      usePetStore.setState({ health: 25, happiness: 25 }), // sad band
    );
    (Haptics.impactAsync as jest.Mock).mockClear();
    const heartsBefore = screen.getAllByText("❤️").length;

    fireEvent.press(monster);
    fireEvent.press(screen.getByLabelText("Pet Nilly"));

    // The reaction still fires: haptic and a new heart.
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await waitForHeartCount(screen, heartsBefore + 1);

    // But the grant is capped: no extra happiness, allowance not exceeded.
    expect(usePetStore.getState().happiness).toBe(25);
    expect(usePlayerStore.getState().tapReactionCount).toBe(5);

    // Still economically neutral in every case.
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(usePlayerStore.getState().spentPoints).toBe(0);
  });
});
