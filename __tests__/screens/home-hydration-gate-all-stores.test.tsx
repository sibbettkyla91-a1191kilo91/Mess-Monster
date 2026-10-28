/**
 * Home must not paint until the player, pet, AND shop saves have loaded.
 * Before this, Home only waited on the player save, so the pet's stat bars
 * and growth stage could show defaults for a frame. Each save is held in
 * flight (deferred AsyncStorage) and released one at a time.
 */
import { act, render } from "@testing-library/react-native";

import HomeScreen from "@/app/(tabs)/index";

jest.mock("@react-native-async-storage/async-storage", () => {
  const holder = globalThis as typeof globalThis & {
    __mmAllStoresResolvers?: Record<string, (value: string | null) => void>;
  };
  holder.__mmAllStoresResolvers ??= {};
  const resolvers = holder.__mmAllStoresResolvers;
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
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers();

const resolvers = () =>
  (
    globalThis as typeof globalThis & {
      __mmAllStoresResolvers: Record<string, (value: string | null) => void>;
    }
  ).__mmAllStoresResolvers;

const PLAYER_SAVE = JSON.stringify({
  state: {
    totalPoints: 100,
    spentPoints: 0,
    streak: 0,
    lastActiveDay: "",
    activeDaysCount: 0,
    isPremium: false,
    selectedMonster: "luna",
    monsterName: "",
    hasCompletedOnboarding: true,
  },
  version: 4,
});

const PET_SAVE = JSON.stringify({
  state: {
    health: 42,
    happiness: 37,
    lastCaredAt: Date.now(),
    lastSessionAt: Date.now(),
    evolutionStage: "teen",
    totalPointsEarned: 0,
    adultVariant: "base",
    categoryCompletions: {},
    claimedStreakMilestones: [],
    pendingMilestoneBanner: null,
    pendingEvolution: null,
    pendingPremiumGate: null,
    premiumGateShownFor: null,
  },
  version: 2,
});

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function release(key: string, value: string | null) {
  await act(async () => {
    resolvers()[key]?.(value);
    await flush();
  });
}

const booting = (screen: ReturnType<typeof render>) =>
  screen.queryByLabelText("Opening Mess Monster") !== null;

describe("Home waits for every save it draws from", () => {
  it("shows the boot screen until player, pet and shop saves all load, then the saved stats", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flush();
    });
    expect(booting(screen)).toBe(true);

    await release("mm-player", PLAYER_SAVE);
    expect(booting(screen)).toBe(true);
    expect(screen.queryByLabelText("Care for Luna")).toBeNull();

    await release("mm-pet", PET_SAVE);
    expect(booting(screen)).toBe(true);
    expect(screen.queryByLabelText("Care for Luna")).toBeNull();

    await release("mm-store-owned", null);
    expect(booting(screen)).toBe(false);
    expect(screen.getByLabelText("Care for Luna")).toBeTruthy();
    expect(screen.getByText(/❤️\s*42/)).toBeTruthy();
  });
});
