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

// Fake timers for the whole file: the screen runs looping/random-delay
// animation timers (bob, wiggle) that must not escape a test's lifetime.
jest.useFakeTimers();

/**
 * Yield one real macrotask so React can commit pending concurrent work.
 *
 * React's scheduler captured the real setImmediate before fake timers were
 * installed, so a state update that no zustand write force-flushes (e.g. the
 * tapHearts update on an allowance-capped press, where recordTapReaction
 * bails before set) commits only on a real event-loop turn — which
 * microtask-only awaits and fake-timer advances never yield to.
 */
async function flushConcurrentWork() {
  const { setImmediate: realSetImmediate } = jest.requireActual("timers");
  await act(async () => {
    await new Promise((resolve) => realSetImmediate(resolve));
  });
}

// health/happiness pairs chosen to land squarely inside each deriveMood band.
const MOODS = [
  ["thriving", 90, 90],
  ["happy", 60, 60],
  ["neutral", 40, 40],
  ["sad", 25, 25],
  ["sick", 5, 5],
] as const;

/** Let store hydration (microtasks) and the deferred decay pass (setImmediate) settle. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(0); // run the deferred (setImmediate) decay pass
  for (let i = 0; i < 10; i++) await Promise.resolve();
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

      fireEvent.press(screen.getByLabelText("Pet Nilly"));

      // Haptic fired (the bounce animation starts on the same code path,
      // bracketed by the haptic above it and the happiness boost below it).
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      // One new floating heart rendered.
      expect(screen.getAllByText("❤️")).toHaveLength(heartsBefore + 1);

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
    const monster = screen.getByLabelText("Pet Nilly");
    for (let i = 0; i < 5; i++) fireEvent.press(monster);
    expect(usePlayerStore.getState().tapReactionCount).toBe(5);
    expect(usePetStore.getState().happiness).toBe(75); // 5 × +3 granted

    // …then the monster turns sad and gets a comfort tap.
    act(() =>
      usePetStore.setState({ health: 25, happiness: 25 }), // sad band
    );
    (Haptics.impactAsync as jest.Mock).mockClear();
    const heartsBefore = screen.getAllByText("❤️").length;

    fireEvent.press(monster);
    await flushConcurrentWork();

    // The reaction still fires: haptic and a new heart.
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("❤️")).toHaveLength(heartsBefore + 1);

    // But the grant is capped: no extra happiness, allowance not exceeded.
    expect(usePetStore.getState().happiness).toBe(25);
    expect(usePlayerStore.getState().tapReactionCount).toBe(5);

    // Still economically neutral in every case.
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(usePlayerStore.getState().spentPoints).toBe(0);
  });
});
