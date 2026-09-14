/**
 * Care moments and glyph bursts are decoration around a write that has
 * already happened. Feed still consumes exactly the chosen snack for +8/+8,
 * Play keeps the toy for +8/+3, nothing leaks across monsters, the moment
 * itself never writes, bursts come and go on a short bounded timer, and
 * unmounting mid-moment leaves no timers behind.
 */
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { AccessibilityInfo } from "react-native";

import HomeScreen from "@/app/(tabs)/index";
import {
  BURST_DURATION_MS,
  MAX_CONCURRENT_BURSTS,
} from "@/components/burst-particles";
import { STORE_ITEMS } from "@/store/store-items";
import { PetSlice } from "@/store/types";
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

const cookie = STORE_ITEMS.find((i) => i.id === "food-cookie")!;
const boba = STORE_ITEMS.find((i) => i.id === "food-boba")!;
const yarn = STORE_ITEMS.find((i) => i.id === "toy-yarn")!;
const ball = STORE_ITEMS.find((i) => i.id === "toy-ball")!;

const reduceMotionMock = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;

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
    tapReactions: {
      nilly: { date: "", count: 0 },
      luna: { date: "", count: 0 },
    },
  });
  const fresh = (slice: PetSlice): PetSlice => ({
    ...slice,
    health: 50,
    happiness: 50,
    lastSessionAt: Date.now(),
    lastCaredAt: Date.now(),
    evolutionStage: "baby" as const,
    pendingEvolution: null,
    pendingPremiumGate: null,
  });
  const by = usePetStore.getState().byMonster;
  usePetStore.setState({
    byMonster: { nilly: fresh(by.nilly), luna: fresh(by.luna) },
    pendingMilestoneBanner: null,
    appliedFeeds: {},
  });
  useStoreStore.setState({
    byMonster: {
      nilly: { owned: {}, placed: {}, equipped: {} },
      luna: { owned: {}, placed: {}, equipped: {} },
    },
    owned: {},
    placed: {},
    equipped: {},
    unsettledFeeds: [],
    appliedFeeds: {},
  });
}

async function mountHome(monster: "nilly" | "luna" = "nilly") {
  const screen = render(<HomeScreen />);
  await act(async () => {
    await flushHydration();
  });
  act(() => seedHome(monster));
  return screen;
}

function feed(screen: ReturnType<typeof render>, name: string, item: string) {
  fireEvent.press(screen.getByLabelText(`Care for ${name}`));
  fireEvent.press(screen.getByLabelText(`Feed ${name}`));
  fireEvent.press(screen.getByLabelText(`Feed ${item}`));
}

function play(screen: ReturnType<typeof render>, name: string, item: string) {
  fireEvent.press(screen.getByLabelText(`Care for ${name}`));
  fireEvent.press(screen.getByLabelText(`Play with ${name}`));
  fireEvent.press(screen.getByLabelText(`Play with ${item}`));
}

function hold(screen: ReturnType<typeof render>, name: string) {
  const monster = screen.getByLabelText(`Care for ${name}`);
  fireEvent(monster, "pressIn");
  fireEvent(monster, "longPress");
  fireEvent(monster, "pressOut");
}

// Bursts are hidden from assistive tech (decorative), so ask for hidden
// elements explicitly.
const HIDDEN = { includeHiddenElements: true } as const;
const liveBursts = (screen: ReturnType<typeof render>) =>
  screen.queryAllByTestId(/^burst-/, HIDDEN).length;

afterEach(() => {
  reduceMotionMock.mockImplementation(() => Promise.resolve(false));
  (Haptics.impactAsync as jest.Mock).mockClear();
});

describe("care moments", () => {
  it("Feed with the moment playing still consumes exactly the chosen snack for +8/+8", async () => {
    const screen = await mountHome();
    act(() => {
      useStoreStore.getState().buyItem(cookie);
      useStoreStore.getState().buyItem(boba);
    });

    feed(screen, "Nilly", "Boba Tea");

    // The snack flies in and the burst is on screen…
    expect(screen.getByTestId("care-prop-feed")).toBeTruthy();
    expect(screen.getByText(boba.emoji)).toBeTruthy();
    expect(screen.getByTestId("burst-feed", HIDDEN)).toBeTruthy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
    // …and the numbers are already final.
    const bag = useStoreStore.getState().owned;
    expect(bag["food-boba"].quantity).toBe(0);
    expect(bag["food-cookie"].quantity).toBe(1);
    expect(usePetStore.getState().health).toBe(58);
    expect(usePetStore.getState().happiness).toBe(58);

    // Feeding again mid-moment is one more feed, not a double.
    act(() => {
      jest.advanceTimersByTime(300);
    });
    feed(screen, "Nilly", "Cookie");
    expect(useStoreStore.getState().owned["food-cookie"].quantity).toBe(0);
    expect(usePetStore.getState().health).toBe(66);
    expect(usePetStore.getState().happiness).toBe(66);

    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(usePetStore.getState().health).toBe(66);
    expect(screen.queryByTestId("care-prop-feed")).toBeNull();
  });

  it("Play keeps the chosen toy and yields +8 happiness / +3 health", async () => {
    const screen = await mountHome();
    act(() => {
      useStoreStore.getState().buyItem(yarn);
      useStoreStore.getState().buyItem(ball);
    });

    play(screen, "Nilly", "Yarn Ball");

    expect(screen.getByTestId("care-prop-play")).toBeTruthy();
    expect(screen.getByText(yarn.emoji)).toBeTruthy();
    expect(screen.getByTestId("burst-play", HIDDEN)).toBeTruthy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
    const bag = useStoreStore.getState().owned;
    expect(bag["toy-yarn"].quantity).toBe(1);
    expect(bag["toy-ball"].quantity).toBe(1);
    expect(usePetStore.getState().happiness).toBe(58);
    expect(usePetStore.getState().health).toBe(53);

    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(usePetStore.getState().happiness).toBe(58);
    expect(usePetStore.getState().health).toBe(53);
  });

  it("feeding Luna leaves Nilly's bag and stats untouched", async () => {
    const screen = await mountHome("luna");
    act(() => {
      useStoreStore.getState().buyItem(cookie, "luna");
      useStoreStore.getState().buyItem(cookie, "nilly");
    });

    feed(screen, "Luna", "Cookie");

    const store = useStoreStore.getState();
    expect(store.byMonster.luna.owned["food-cookie"].quantity).toBe(0);
    expect(store.byMonster.nilly.owned["food-cookie"].quantity).toBe(1);
    const pet = usePetStore.getState();
    expect(pet.byMonster.luna.health).toBe(58);
    expect(pet.byMonster.luna.happiness).toBe(58);
    expect(pet.byMonster.nilly.health).toBe(50);
    expect(pet.byMonster.nilly.happiness).toBe(50);
  });

  it("the moment itself writes nothing: state after it ends equals state right after the tap", async () => {
    const screen = await mountHome();
    act(() => {
      useStoreStore.getState().buyItem(cookie);
      useStoreStore.getState().buyItem(yarn);
    });

    feed(screen, "Nilly", "Cookie");
    play(screen, "Nilly", "Yarn Ball");
    hold(screen, "Nilly");

    const pet = usePetStore.getState();
    const player = usePlayerStore.getState();
    const store = useStoreStore.getState();
    const tasks = useTasksStore.getState();

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(usePetStore.getState()).toBe(pet);
    expect(usePlayerStore.getState()).toBe(player);
    expect(useStoreStore.getState()).toBe(store);
    expect(useTasksStore.getState()).toBe(tasks);
  });

  it("a burst mounts, then fully unmounts after its duration", async () => {
    const screen = await mountHome();

    hold(screen, "Nilly");
    expect(screen.getByTestId("burst-pet", HIDDEN)).toBeTruthy();
    // The floating ❤️ per pet is still exactly one new heart.
    expect(screen.getAllByText("❤️")).toHaveLength(2);

    act(() => {
      jest.advanceTimersByTime(BURST_DURATION_MS - 50);
    });
    expect(screen.getByTestId("burst-pet", HIDDEN)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId("burst-pet", HIDDEN)).toBeNull();
    expect(liveBursts(screen)).toBe(0);
  });

  it("caps live bursts even when a pet is spammed ten times", async () => {
    const screen = await mountHome();

    for (let i = 0; i < 10; i++) hold(screen, "Nilly");

    expect(liveBursts(screen)).toBeLessThanOrEqual(MAX_CONCURRENT_BURSTS);
    expect(liveBursts(screen)).toBeGreaterThan(0);
    // Every hold still went through the one pet path (cap at 5 grants).
    expect(usePlayerStore.getState().tapReactionCount).toBe(5);
    expect(usePetStore.getState().happiness).toBe(65);

    act(() => {
      jest.advanceTimersByTime(BURST_DURATION_MS + 50);
    });
    expect(liveBursts(screen)).toBe(0);
    // And the cap frees up again.
    hold(screen, "Nilly");
    expect(liveBursts(screen)).toBe(1);
  });

  it("unmounting mid-moment clears every timer", async () => {
    const screen = await mountHome();
    act(() => {
      useStoreStore.getState().buyItem(cookie);
    });

    feed(screen, "Nilly", "Cookie");
    hold(screen, "Nilly");
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    screen.unmount();
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("with reduce motion on, the snack is still eaten and no prop flies", async () => {
    reduceMotionMock.mockImplementation(() => Promise.resolve(true));
    const screen = await mountHome();
    await act(async () => {
      await flushHydration();
    });
    act(() => {
      useStoreStore.getState().buyItem(cookie);
    });

    feed(screen, "Nilly", "Cookie");

    expect(screen.queryByTestId("care-prop-feed")).toBeNull();
    expect(useStoreStore.getState().owned["food-cookie"].quantity).toBe(0);
    expect(usePetStore.getState().health).toBe(58);
    expect(usePetStore.getState().happiness).toBe(58);
  });
});
