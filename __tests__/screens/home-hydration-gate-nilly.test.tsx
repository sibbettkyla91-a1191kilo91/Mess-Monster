/**
 * Sibling of home-hydration-gate.test.tsx. That file hydrates a Luna save on
 * the module-scoped store singleton; this file hydrates a Nilly save so a
 * persisted Nilly player still gets Nilly after the gate, not a blank Home.
 */
import { act, render } from "@testing-library/react-native";
import { Image, ImageBackground } from "react-native";

import HomeScreen from "@/app/(tabs)/index";
import { usePlayerStore } from "@/store/use-player-store";

type Resolvers = Record<string, (value: string | null) => void>;

const resolverHolder = () => {
  const holder = globalThis as typeof globalThis & {
    __mmNillyHydrationResolvers?: Resolvers;
  };
  holder.__mmNillyHydrationResolvers ??= {};
  return holder.__mmNillyHydrationResolvers;
};

jest.mock("@react-native-async-storage/async-storage", () => {
  const holder = globalThis as typeof globalThis & {
    __mmNillyHydrationResolvers?: Record<
      string,
      (value: string | null) => void
    >;
  };
  holder.__mmNillyHydrationResolvers ??= {};
  const resolvers = holder.__mmNillyHydrationResolvers;
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

const NILLY_HABITAT = require("@/assets/images/nilly-habitat.jpg");
const LUNA_HABITAT = require("@/assets/images/luna-habitat.jpg");
const NILLY_TEEN = require("@/assets/images/nilly_teen.png");
const LUNA_TEEN = require("@/assets/images/luna_teen.png");

const PLAYER_NILLY_SAVE = JSON.stringify({
  state: {
    totalPoints: 100,
    spentPoints: 0,
    streak: 0,
    lastActiveDay: "",
    activeDaysCount: 0,
    isPremium: false,
    selectedMonster: "nilly",
    monsterName: "",
    hasCompletedOnboarding: true,
  },
  version: 4,
});

const PET_SAVE = JSON.stringify({
  state: {
    health: 100,
    happiness: 100,
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

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

const habitatSources = (screen: ReturnType<typeof render>) =>
  screen
    .UNSAFE_queryAllByType(ImageBackground)
    .map((node) => node.props.source);

const imageSources = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_queryAllByType(Image).map((node) => node.props.source);

describe("Home hydration gate — persisted Nilly", () => {
  it("does not mount Nilly (or Luna) before the player store has hydrated", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
    expect(screen.queryByLabelText("Pet Luna")).toBeNull();
    expect(habitatSources(screen)).toHaveLength(0);
    expect(imageSources(screen)).toHaveLength(0);
  });

  it("mounts Nilly's habitat and sprite once the persisted Nilly save lands", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();

    const resolvers = resolverHolder();
    await act(async () => {
      resolvers["mm-player"]?.(PLAYER_NILLY_SAVE);
      resolvers["mm-pet"]?.(PET_SAVE);
      await flushHydration();
    });

    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    expect(screen.getByLabelText("Pet Nilly")).toBeTruthy();
    expect(screen.queryByLabelText("Pet Luna")).toBeNull();
    expect(habitatSources(screen)).toEqual([NILLY_HABITAT]);
    expect(imageSources(screen)).toContain(NILLY_TEEN);
    expect(imageSources(screen)).not.toContain(LUNA_TEEN);
    expect(imageSources(screen)).not.toContain(LUNA_HABITAT);
  });
});
