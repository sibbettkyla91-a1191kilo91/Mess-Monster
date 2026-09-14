/**
 * The talk-back caption under the sprite: appears once the room is drawn,
 * rotates on an idle timer, answers a care action right away, and never
 * writes to a persisted store. The bottom panel keeps the one-word mood
 * label and no longer carries a verdict sentence.
 */
import { act, fireEvent, render } from "@testing-library/react-native";

import HomeScreen from "@/app/(tabs)/index";
import { allLines, VOICE_LINES } from "@/store/monster-voice";
import { STORE_ITEMS } from "@/store/store-items";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";

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

const cookie = STORE_ITEMS.find((i) => i.id === "food-cookie")!;

async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function seedHome(monster: "nilly" | "luna" = "nilly") {
  usePlayerStore.setState({
    selectedMonster: monster,
    monsterName: monster === "nilly" ? "Nilly" : "Luna",
    totalPoints: 100,
    spentPoints: 0,
    lastTapReactionDate: "",
    tapReactionCount: 0,
  });
  usePetStore.setState({
    health: 60,
    happiness: 60,
    lastSessionAt: Date.now(),
    lastCaredAt: Date.now(),
    evolutionStage: "baby",
    pendingEvolution: null,
    pendingPremiumGate: null,
    pendingMilestoneBanner: null,
  });
  useStoreStore.setState({ owned: {}, placed: {}, equipped: {} });
}

/** The talk-back line currently on screen, or null. */
function currentLine(
  screen: ReturnType<typeof render>,
  monster: "nilly" | "luna",
): string | null {
  for (const line of allLines(monster)) {
    if (screen.queryByText(line)) return line;
  }
  return null;
}

describe("Home talk-back caption", () => {
  it("shows a line from the idle pool and rotates it without repeating", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome());
    act(() => {
      jest.advanceTimersByTime(0);
    });

    const first = currentLine(screen, "nilly");
    expect(first).not.toBeNull();
    const idlePool = new Set([
      ...VOICE_LINES.nilly.general,
      ...VOICE_LINES.nilly.mood.happy,
      ...VOICE_LINES.nilly.time.morning,
      ...VOICE_LINES.nilly.time.afternoon,
      ...VOICE_LINES.nilly.time.evening,
      ...VOICE_LINES.nilly.time.late,
    ]);
    expect(idlePool.has(first!)).toBe(true);

    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    const second = currentLine(screen, "nilly");
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("answers a care action immediately from that action's bucket", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => {
      seedHome();
      useStoreStore.getState().buyItem(cookie);
    });

    fireEvent.press(screen.getByLabelText("Care for Nilly"));
    fireEvent.press(screen.getByLabelText("Feed Nilly"));
    fireEvent.press(screen.getByLabelText("Feed Cookie"));

    const line = currentLine(screen, "nilly");
    expect(VOICE_LINES.nilly.feed).toContain(line);

    fireEvent.press(screen.getByLabelText("Care for Nilly"));
    fireEvent.press(screen.getByLabelText("Pet Nilly"));
    expect(VOICE_LINES.nilly.pet).toContain(currentLine(screen, "nilly"));
  });

  it("speaks in Luna's voice for a Luna player", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome("luna"));
    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(currentLine(screen, "luna")).not.toBeNull();
    expect(currentLine(screen, "nilly")).toBeNull();
  });

  it("rotating lines for a minute writes nothing to the persisted stores", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome());
    act(() => {
      jest.advanceTimersByTime(0);
    });

    const pet = usePetStore.getState();
    const player = usePlayerStore.getState();
    const store = useStoreStore.getState();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(usePetStore.getState()).toBe(pet);
    expect(usePlayerStore.getState()).toBe(player);
    expect(useStoreStore.getState()).toBe(store);
    expect(screen.getByText("Happy")).toBeTruthy();
  });

  it("dropped the old verdict sentences from the bottom panel", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => {
      seedHome();
      usePetStore.setState({ health: 25, happiness: 25 }); // sad band
    });

    expect(screen.getByText("Sad")).toBeTruthy();
    expect(screen.queryByText(/misses seeing you clean/)).toBeNull();
    expect(screen.queryByText(/neglect/i)).toBeNull();
    expect(screen.queryByText(/mess grows/)).toBeNull();
  });
});
