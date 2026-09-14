/**
 * Touch on the monster: a short tap opens the care menu and grants nothing;
 * pressing and holding pets — through the one existing pet path (daily
 * allowance, +3 happiness while under it, bounce + heart always). One hold
 * is exactly one pet, a capped hold still animates, a hold before hydration
 * writes nothing, and Luna's hold touches only Luna's numbers.
 */
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import HomeScreen from "@/app/(tabs)/index";
import { VOICE_LINES } from "@/store/monster-voice";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";

type Resolvers = Record<string, (value: string | null) => void>;

const resolverHolder = () => {
  const holder = globalThis as typeof globalThis & {
    __mmHoldResolvers?: Resolvers;
  };
  holder.__mmHoldResolvers ??= {};
  return holder.__mmHoldResolvers;
};

// Deferred AsyncStorage keyed by persist name so one test can hydrate the
// player store (which draws the monster) while the pet store is still
// loading — the window in which a hold must be a no-op.
jest.mock("@react-native-async-storage/async-storage", () => {
  const holder = globalThis as typeof globalThis & {
    __mmHoldResolvers?: Record<string, (value: string | null) => void>;
  };
  holder.__mmHoldResolvers ??= {};
  const resolvers = holder.__mmHoldResolvers;
  return {
    getItem: jest.fn(
      (key: string) =>
        new Promise((resolve) => {
          resolvers[key] = resolve;
        }),
    ),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };
});

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
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Resolve every store's save as "nothing persisted": full hydration. */
async function hydrateAll() {
  const resolvers = resolverHolder();
  await act(async () => {
    for (const key of Object.keys(resolvers)) resolvers[key]?.(null);
    await flushHydration();
  });
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
  usePetStore.setState({
    byMonster: {
      nilly: {
        ...usePetStore.getState().byMonster.nilly,
        health: 50,
        happiness: 50,
        lastSessionAt: Date.now(),
        lastCaredAt: Date.now(),
        evolutionStage: "baby",
        pendingEvolution: null,
        pendingPremiumGate: null,
      },
      luna: {
        ...usePetStore.getState().byMonster.luna,
        health: 50,
        happiness: 50,
        lastSessionAt: Date.now(),
        lastCaredAt: Date.now(),
        evolutionStage: "baby",
        pendingEvolution: null,
        pendingPremiumGate: null,
      },
    },
    pendingMilestoneBanner: null,
  });
  useStoreStore.setState({ owned: {}, placed: {}, equipped: {} });
}

/** A full hold gesture: finger down, long-press fires, finger up. */
function hold(
  monster: ReturnType<ReturnType<typeof render>["getByLabelText"]>,
) {
  fireEvent(monster, "pressIn");
  fireEvent(monster, "longPress");
  fireEvent(monster, "pressOut");
}

const heartCount = (screen: ReturnType<typeof render>) =>
  screen.getAllByText("❤️").length;

describe("hold-to-pet", () => {
  beforeEach(() => {
    (Haptics.impactAsync as jest.Mock).mockClear();
    (Haptics.selectionAsync as jest.Mock).mockClear();
  });

  it("does nothing to the stores when held before the pet store has hydrated", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    // Only the player store hydrates: the monster is drawn, but Home is
    // not yet allowed to write.
    await act(async () => {
      resolverHolder()["mm-player"]?.(null);
      await flushHydration();
    });
    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    expect(usePetStore.persist.hasHydrated()).toBe(false);

    const happinessBefore = usePetStore.getState().happiness;
    hold(screen.getByLabelText("Care for Nilly"));

    expect(usePetStore.getState().happiness).toBe(happinessBefore);
    expect(usePlayerStore.getState().tapReactionCount).toBe(0);
    screen.unmount();
    await hydrateAll();
  });

  it("a short tap opens the care menu and grants nothing", async () => {
    const screen = render(<HomeScreen />);
    await hydrateAll();
    act(() => seedHome());

    const monster = screen.getByLabelText("Care for Nilly");
    fireEvent(monster, "pressIn");
    fireEvent(monster, "pressOut");
    fireEvent.press(monster);

    expect(screen.getByLabelText("Pet Nilly")).toBeTruthy();
    expect(usePetStore.getState().happiness).toBe(50);
    expect(usePlayerStore.getState().tapReactionCount).toBe(0);
    // The tap acknowledges with the lightest tick, not the pet's impact.
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("one hold = one pet: +3 once, one allowance, one heart, a pet line", async () => {
    const screen = render(<HomeScreen />);
    await hydrateAll();
    act(() => seedHome());

    const hearts = heartCount(screen);
    hold(screen.getByLabelText("Care for Nilly"));

    expect(usePetStore.getState().happiness).toBe(53);
    expect(usePlayerStore.getState().tapReactionCount).toBe(1);
    expect(usePlayerStore.getState().tapReactions.nilly.count).toBe(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(heartCount(screen)).toBe(hearts + 1);
    // The menu did not open — a hold is not a tap.
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
    const line = VOICE_LINES.nilly.pet.find((l) => screen.queryByText(l));
    expect(line).toBeDefined();
    // Economically neutral.
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(usePlayerStore.getState().spentPoints).toBe(0);
  });

  it("a hold while the menu is open closes it and pets once", async () => {
    const screen = render(<HomeScreen />);
    await hydrateAll();
    act(() => seedHome());

    const monster = screen.getByLabelText("Care for Nilly");
    fireEvent.press(monster);
    expect(screen.getByLabelText("Pet Nilly")).toBeTruthy();

    hold(monster);
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
    expect(usePetStore.getState().happiness).toBe(53);
    expect(usePlayerStore.getState().tapReactionCount).toBe(1);
  });

  it("a sixth hold still animates and ticks but grants nothing", async () => {
    const screen = render(<HomeScreen />);
    await hydrateAll();
    act(() => seedHome());

    const monster = screen.getByLabelText("Care for Nilly");
    for (let i = 0; i < 5; i++) hold(monster);
    expect(usePetStore.getState().happiness).toBe(65);
    expect(usePlayerStore.getState().tapReactionCount).toBe(5);

    (Haptics.impactAsync as jest.Mock).mockClear();
    (Haptics.selectionAsync as jest.Mock).mockClear();
    const hearts = heartCount(screen);

    hold(monster);

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(heartCount(screen)).toBe(hearts + 1);
    expect(usePetStore.getState().happiness).toBe(65);
    expect(usePlayerStore.getState().tapReactionCount).toBe(5);
  });

  it("keeps ticking softly only while held, then stops", async () => {
    const screen = render(<HomeScreen />);
    await hydrateAll();
    act(() => seedHome());

    const monster = screen.getByLabelText("Care for Nilly");
    fireEvent(monster, "pressIn");
    fireEvent(monster, "longPress");
    (Haptics.selectionAsync as jest.Mock).mockClear();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const ticksWhileHeld = (Haptics.selectionAsync as jest.Mock).mock.calls
      .length;
    expect(ticksWhileHeld).toBeGreaterThan(0);

    fireEvent(monster, "pressOut");
    (Haptics.selectionAsync as jest.Mock).mockClear();
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    // Still exactly one pet for the whole gesture.
    expect(usePlayerStore.getState().tapReactionCount).toBe(1);
  });

  it("the menu's Pet button still works exactly as before", async () => {
    const screen = render(<HomeScreen />);
    await hydrateAll();
    act(() => seedHome());

    fireEvent.press(screen.getByLabelText("Care for Nilly"));
    fireEvent.press(screen.getByLabelText("Pet Nilly"));
    expect(usePetStore.getState().happiness).toBe(53);
    expect(usePlayerStore.getState().tapReactionCount).toBe(1);
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
  });

  it("holding Luna changes only Luna's happiness and allowance", async () => {
    const screen = render(<HomeScreen />);
    await hydrateAll();
    act(() => seedHome("luna"));

    hold(screen.getByLabelText("Care for Luna"));

    const pet = usePetStore.getState();
    expect(pet.byMonster.luna.happiness).toBe(53);
    expect(pet.byMonster.nilly.happiness).toBe(50);
    const taps = usePlayerStore.getState().tapReactions;
    expect(taps.luna.count).toBe(1);
    expect(taps.nilly.count).toBe(0);
    const line = VOICE_LINES.luna.pet.find((l) => screen.queryByText(l));
    expect(line).toBeDefined();
  });
});
