/**
 * The bottom stat panel collapses to a peek handle so the room (and its
 * placed decor/toys) stays visible. Renders the real HomeScreen, taps the
 * handle, and asserts the persisted collapsed state flips both ways and
 * that the toggle is announced to assistive tech via its flipping label.
 */
import { act, fireEvent, render } from "@testing-library/react-native";

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

/** Let store hydration (microtasks) and the deferred decay pass (setImmediate) settle. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(0); // run the deferred (setImmediate) decay pass
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("stat panel collapse toggle", () => {
  it("defaults to expanded, and tapping the handle toggles collapsed state both ways", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    // Fresh install: expanded.
    expect(usePlayerStore.getState().statPanelCollapsed).toBe(false);

    // Collapse. The label doubles as the a11y announcement of what the
    // button does next, so it must flip with the state.
    fireEvent.press(screen.getByLabelText("Hide monster stats"));
    expect(usePlayerStore.getState().statPanelCollapsed).toBe(true);

    // Expand again via the same handle, now labelled for expanding.
    fireEvent.press(screen.getByLabelText("Show monster stats"));
    expect(usePlayerStore.getState().statPanelCollapsed).toBe(false);
    expect(screen.getByLabelText("Hide monster stats")).toBeTruthy();
  });
});

describe("level vs stage hint", () => {
  const COPY = "Level opens new things. Stage grows with time together.";

  it.each(["nilly", "luna"] as const)(
    "%s: one quiet line under the stage and level pills says which is which",
    async (monster) => {
      const screen = render(<HomeScreen />);
      await act(async () => {
        await flushHydration();
      });
      act(() => {
        usePlayerStore.setState({ selectedMonster: monster });
        usePetStore.setState({ evolutionStage: "baby", totalPointsEarned: 0 });
      });

      // Both systems stay on screen: the stage pill, the level pill, and the
      // one line explaining them.
      expect(screen.getByText("Baby")).toBeTruthy();
      expect(screen.getByText("Lv 1")).toBeTruthy();
      expect(screen.getByText(COPY)).toBeTruthy();
    },
  );
});
