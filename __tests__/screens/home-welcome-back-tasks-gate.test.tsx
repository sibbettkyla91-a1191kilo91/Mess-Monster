/**
 * The welcome-back hello waits for the tasks store too. Before that save
 * lands, today's progress reads as the unhydrated default — nothing touched
 * — so a tiny dare picked at that moment could name a task the player
 * already finished this morning. Own file: the stores hydrate once per
 * module registry, and this needs the tasks save still in flight.
 */
import { act, render } from "@testing-library/react-native";

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
    __mmWelcomeGateResolvers?: Resolvers;
  };
  holder.__mmWelcomeGateResolvers ??= {};
  return holder.__mmWelcomeGateResolvers;
};

jest.mock("@react-native-async-storage/async-storage", () => {
  const holder = globalThis as typeof globalThis & {
    __mmWelcomeGateResolvers?: Record<string, (value: string | null) => void>;
  };
  holder.__mmWelcomeGateResolvers ??= {};
  const resolvers = holder.__mmWelcomeGateResolvers;
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

const ROLL: PresetTask[] = [
  {
    id: "wipe-counter",
    label: "Wipe the counter",
    category: "kitchen",
    pointValue: 10,
  },
  { id: "make-bed", label: "Make the bed", category: "bedroom", pointValue: 15 },
];

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

const welcomeLine = (screen: ReturnType<typeof render>) =>
  VOICE_LINES.nilly.welcome.find((l) => screen.queryByText(l)) ?? null;

const dareChip = (screen: ReturnType<typeof render>) =>
  screen.queryByLabelText(/^Tiny dare: /);

it("holds the hello until the tasks save has loaded, so the dare reads real progress", async () => {
  const screen = render(<HomeScreen />);

  // Every store but tasks hydrates with nothing saved.
  await act(async () => {
    const resolvers = resolverHolder();
    for (const key of Object.keys(resolvers)) {
      if (key !== "mm-tasks") resolvers[key]?.(null);
    }
    await flushHydration();
  });
  expect(usePlayerStore.persist.hasHydrated()).toBe(true);
  expect(usePetStore.persist.hasHydrated()).toBe(true);
  expect(useStoreStore.persist.hasHydrated()).toBe(true);
  expect(useTasksStore.persist.hasHydrated()).toBe(false);

  act(() => {
    usePlayerStore.setState({
      selectedMonster: "nilly",
      monsterName: "Nilly",
      totalPoints: 100,
      spentPoints: 0,
    });
    const by = usePetStore.getState().byMonster;
    usePetStore.setState({
      byMonster: {
        nilly: { ...by.nilly, health: 50, happiness: 50 },
        luna: { ...by.luna, health: 50, happiness: 50 },
      },
    });
    useSessionStore.setState({ pendingWelcome: false, awayMs: 0 });
  });
  act(() => {
    jest.advanceTimersByTime(0);
  });

  // The root layout flags a five-hour gap.
  act(() => {
    useSessionStore.getState().noteReturn(WELCOME_BACK_THRESHOLD_MS + 3_600_000);
  });
  act(() => {
    jest.advanceTimersByTime(0);
  });

  // Nothing yet: the flag stays pending, no line, no chip.
  expect(useSessionStore.getState().pendingWelcome).toBe(true);
  expect(welcomeLine(screen)).toBeNull();
  expect(dareChip(screen)).toBeNull();

  // The tasks save lands: the cheapest task was already claimed today.
  await act(async () => {
    resolverHolder()["mm-tasks"]?.(
      JSON.stringify({
        state: {
          tasks: [],
          dailyRoll: ROLL,
          dailyRollDate: localDayString(),
          taskProgress: {
            "wipe-counter": { state: "claimed", hasPhoto: false },
          },
          pendingRewards: [],
          unsettledGrants: [],
          appliedRewardGrants: {},
        },
        version: 3,
      }),
    );
    await flushHydration();
  });
  act(() => {
    jest.advanceTimersByTime(0);
  });

  expect(useTasksStore.persist.hasHydrated()).toBe(true);
  expect(useSessionStore.getState().pendingWelcome).toBe(false);
  expect(welcomeLine(screen)).not.toBeNull();
  const chip = dareChip(screen);
  expect(chip).not.toBeNull();
  expect(chip!.props.accessibilityLabel).toContain("Make the bed");
  expect(chip!.props.accessibilityLabel).not.toContain("Wipe the counter");
});
