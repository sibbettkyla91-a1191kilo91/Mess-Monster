/**
 * The hello itself, on Home. Once the root layout has flagged a 4+ hour gap,
 * Home says one welcome line, puffs one welcome burst, spends the flag, and
 * — when today's roll still has an untouched task — offers the cheapest one
 * as a tiny dare. The dare only opens the tasks tab; it never starts, grants,
 * or marks anything. It leaves on tap, after 20 s, or on any care action.
 * The whole hello is a read: stats, points, streak, and task progress are
 * the same objects before and after.
 */
import { act, fireEvent, render } from "@testing-library/react-native";

import HomeScreen from "@/app/(tabs)/index";
import { VOICE_LINES } from "@/store/monster-voice";
import { PresetTask } from "@/store/preset-tasks";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import {
  useSessionStore,
  WELCOME_BACK_THRESHOLD_MS,
} from "@/store/use-session-store";
import { useStoreStore } from "@/store/use-store-store";
import { useTasksStore } from "@/store/use-tasks-store";
import { localDayString } from "@/utils/local-day";

type Resolvers = Record<string, (value: string | null) => void>;

const resolverHolder = () => {
  const holder = globalThis as typeof globalThis & {
    __mmWelcomeResolvers?: Resolvers;
  };
  holder.__mmWelcomeResolvers ??= {};
  return holder.__mmWelcomeResolvers;
};

// Deferred AsyncStorage keyed by persist name: Home draws only after the
// stores hydrate, so each test resolves the saves before it starts.
jest.mock("@react-native-async-storage/async-storage", () => {
  const holder = globalThis as typeof globalThis & {
    __mmWelcomeResolvers?: Record<string, (value: string | null) => void>;
  };
  holder.__mmWelcomeResolvers ??= {};
  const resolvers = holder.__mmWelcomeResolvers;
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

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    navigate: (...args: unknown[]) => mockNavigate(...args),
    replace: jest.fn(),
  }),
}));

jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

const HIDDEN = { includeHiddenElements: true } as const;
const FIVE_HOURS = WELCOME_BACK_THRESHOLD_MS + 3_600_000;

// Three tasks with distinct point values, so "lowest untouched" is a real
// choice rather than the first entry.
const ROLL: PresetTask[] = [
  {
    id: "wipe-counter",
    label: "Wipe the counter",
    category: "kitchen",
    pointValue: 10,
  },
  { id: "make-bed", label: "Make the bed", category: "bedroom", pointValue: 15 },
  {
    id: "wash-dishes",
    label: "Wash the dishes",
    category: "kitchen",
    pointValue: 20,
  },
];

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Resolve every store's save as "nothing persisted": full hydration. */
async function hydrate() {
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
    streak: 3,
    lastTapReactionDate: "",
    tapReactionCount: 0,
    tapReactions: {
      nilly: { date: "", count: 0 },
      luna: { date: "", count: 0 },
    },
  });
  const by = usePetStore.getState().byMonster;
  const fresh = (slice: typeof by.nilly) => ({
    ...slice,
    health: 50,
    happiness: 50,
    lastSessionAt: Date.now(),
    lastCaredAt: Date.now(),
    evolutionStage: "baby" as const,
    pendingEvolution: null,
    pendingPremiumGate: null,
  });
  usePetStore.setState({
    byMonster: { nilly: fresh(by.nilly), luna: fresh(by.luna) },
    pendingMilestoneBanner: null,
  });
  useStoreStore.setState({ owned: {}, placed: {}, equipped: {} });
}

/** Today's roll with the cheapest task already claimed. */
function seedTasks() {
  useTasksStore.setState({
    dailyRoll: ROLL,
    dailyRollDate: localDayString(),
    taskProgress: {
      "wipe-counter": { state: "claimed", hasPhoto: false },
    },
  });
}

async function mountHome() {
  const screen = render(<HomeScreen />);
  await hydrate();
  act(() => {
    seedHome();
    seedTasks();
    useSessionStore.setState({ pendingWelcome: false, awayMs: 0 });
  });
  act(() => {
    jest.advanceTimersByTime(0);
  });
  return screen;
}

/** What the root layout does on a 4+ hour return. */
function comeBack() {
  act(() => {
    useSessionStore.getState().noteReturn(FIVE_HOURS);
  });
  act(() => {
    jest.advanceTimersByTime(0);
  });
}

const welcomeLine = (
  screen: ReturnType<typeof render>,
  monster: "nilly" | "luna" = "nilly",
) => VOICE_LINES[monster].welcome.find((l) => screen.queryByText(l)) ?? null;

const dareChip = (screen: ReturnType<typeof render>) =>
  screen.queryByLabelText(/^Tiny dare: /);

beforeEach(() => {
  mockNavigate.mockClear();
});

describe("welcome-back on Home", () => {
  it("says one welcome line, puffs one welcome burst, and spends the flag", async () => {
    const screen = await mountHome();
    expect(welcomeLine(screen)).toBeNull();

    comeBack();

    expect(welcomeLine(screen)).not.toBeNull();
    expect(screen.queryAllByTestId("burst-welcome", HIDDEN)).toHaveLength(1);
    expect(useSessionStore.getState().pendingWelcome).toBe(false);
    expect(useSessionStore.getState().awayMs).toBe(0);
  });

  it("is a pure read: stats, points, streak, and task progress are untouched", async () => {
    const screen = await mountHome();
    const pet = usePetStore.getState();
    const player = usePlayerStore.getState();
    const store = useStoreStore.getState();
    const tasks = useTasksStore.getState();

    comeBack();
    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(usePetStore.getState()).toBe(pet);
    expect(usePlayerStore.getState()).toBe(player);
    expect(useStoreStore.getState()).toBe(store);
    expect(useTasksStore.getState()).toBe(tasks);
    expect(usePlayerStore.getState().streak).toBe(3);
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(usePlayerStore.getState().tapReactionCount).toBe(0);
    expect(screen.getByText("Nilly")).toBeTruthy();
  });

  it("offers the cheapest task that has not been started, not the cheapest overall", async () => {
    const screen = await mountHome();

    comeBack();

    const chip = dareChip(screen);
    expect(chip).not.toBeNull();
    expect(chip!.props.accessibilityLabel).toContain("Make the bed");
    expect(chip!.props.accessibilityLabel).toContain("15 points");
    expect(chip!.props.accessibilityLabel).not.toContain("Wipe the counter");
  });

  it("offers no dare when every task in today's roll has been touched", async () => {
    const screen = await mountHome();
    act(() => {
      useTasksStore.setState({
        taskProgress: {
          "wipe-counter": { state: "claimed", hasPhoto: false },
          "make-bed": { state: "waiting", hasPhoto: false },
          "wash-dishes": { state: "reward_ready", hasPhoto: false },
        },
      });
    });

    comeBack();

    expect(welcomeLine(screen)).not.toBeNull();
    expect(dareChip(screen)).toBeNull();
  });

  it("tapping the dare only opens the tasks tab: no progress, no points, no streak change", async () => {
    const screen = await mountHome();
    comeBack();
    const tasks = useTasksStore.getState();
    const player = usePlayerStore.getState();

    fireEvent.press(dareChip(screen)!);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/explore");
    expect(useTasksStore.getState()).toBe(tasks);
    expect(useTasksStore.getState().taskProgress["make-bed"]).toBeUndefined();
    expect(usePlayerStore.getState()).toBe(player);
    expect(dareChip(screen)).toBeNull();
  });

  it("the dare leaves on its own after 20 seconds", async () => {
    const screen = await mountHome();
    comeBack();
    expect(dareChip(screen)).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(19_500);
    });
    expect(dareChip(screen)).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(dareChip(screen)).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("any care action dismisses the dare", async () => {
    const screen = await mountHome();
    comeBack();
    expect(dareChip(screen)).not.toBeNull();

    const monster = screen.getByLabelText("Care for Nilly");
    fireEvent(monster, "pressIn");
    fireEvent(monster, "longPress");
    fireEvent(monster, "pressOut");

    expect(dareChip(screen)).toBeNull();
    // The pet itself still went through the one pet path.
    expect(usePetStore.getState().happiness).toBe(53);
    expect(usePlayerStore.getState().tapReactionCount).toBe(1);
  });

  it("shows exactly one hello per return, and none without a fresh flag", async () => {
    const screen = await mountHome();
    comeBack();
    expect(screen.queryAllByTestId("burst-welcome", HIDDEN)).toHaveLength(1);

    // Time passes, the idle line rotates; no second hello appears.
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.queryAllByTestId("burst-welcome", HIDDEN)).toHaveLength(0);
    expect(useSessionStore.getState().pendingWelcome).toBe(false);

    // A second real gap is a second hello — one, not two.
    comeBack();
    expect(screen.queryAllByTestId("burst-welcome", HIDDEN)).toHaveLength(1);
  });

  it("speaks in Luna's welcome voice for a Luna player", async () => {
    const screen = render(<HomeScreen />);
    await hydrate();
    act(() => {
      seedHome("luna");
      seedTasks();
      useSessionStore.setState({ pendingWelcome: false, awayMs: 0 });
    });
    act(() => {
      jest.advanceTimersByTime(0);
    });

    comeBack();

    expect(welcomeLine(screen, "luna")).not.toBeNull();
    expect(welcomeLine(screen, "nilly")).toBeNull();
  });
});
