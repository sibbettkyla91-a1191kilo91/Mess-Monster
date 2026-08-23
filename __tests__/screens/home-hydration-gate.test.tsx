/**
 * Home keys every pixel off the chosen monster, but selectedMonster falls back
 * to Nilly until the player store rehydrates. A persisted Luna player would
 * therefore get Nilly's room, sprite, and mint palette for a frame before it
 * snapped over to Luna — the startup flash.
 *
 * These tests render the real Home screen while player hydration is still in
 * flight (AsyncStorage deferred, resolved by hand), and assert the wrong
 * monster and habitat are never mounted — not merely hidden — and that the
 * first monster/habitat to mount is the persisted one.
 */
import { act, render } from "@testing-library/react-native";
import { Image, ImageBackground } from "react-native";

import HomeScreen from "@/app/(tabs)/index";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";

type Resolvers = Record<string, (value: string | null) => void>;

/** Shared holder, created inside the mock factory: the stores are imported (and
 * so call getItem) before this module's own consts initialise. */
const resolverHolder = () => {
  const holder = globalThis as typeof globalThis & {
    __mmHydrationResolvers?: Resolvers;
  };
  holder.__mmHydrationResolvers ??= {};
  return holder.__mmHydrationResolvers;
};

// Deferred AsyncStorage keyed by persist name: hydration stays in flight until
// a test resolves that key — see tasks-hydration.test.ts.
jest.mock("@react-native-async-storage/async-storage", () => {
  const holder = globalThis as typeof globalThis & {
    __mmHydrationResolvers?: Record<string, (value: string | null) => void>;
  };
  holder.__mmHydrationResolvers ??= {};
  const resolvers = holder.__mmHydrationResolvers;
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

// Fake timers for the whole file: Home runs looping/random-delay animation
// timers (bob, wiggle) that must not escape a test's lifetime.
jest.useFakeTimers();

const NILLY_HABITAT = require("@/assets/images/nilly-habitat.jpg");
const LUNA_HABITAT = require("@/assets/images/luna-habitat.jpg");
const NILLY_TEEN = require("@/assets/images/nilly_teen.png");
const LUNA_TEEN = require("@/assets/images/luna_teen.png");

/** A returning Luna player — the save the default fallback contradicts. */
const PLAYER_LUNA_SAVE = JSON.stringify({
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

/** Drain hydration's promise chain plus the pet store's deferred pass. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Resolve the player and pet saves, completing hydration. */
async function completeHydration() {
  const resolvers = resolverHolder();
  await act(async () => {
    resolvers["mm-player"]?.(PLAYER_LUNA_SAVE);
    resolvers["mm-pet"]?.(PET_SAVE);
    await flushHydration();
  });
}

const habitatSources = (screen: ReturnType<typeof render>) =>
  screen
    .UNSAFE_queryAllByType(ImageBackground)
    .map((node) => node.props.source);

/** Every image actually mounted on the screen, habitat and sprite alike. */
const imageSources = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_queryAllByType(Image).map((node) => node.props.source);

describe("Home hydration gate", () => {
  it("mounts no monster before the player store has hydrated", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration(); // nothing resolved — still unhydrated
    });

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);
    // The default fallback monster must never appear.
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
    expect(screen.queryByLabelText("Pet Luna")).toBeNull();
    // No sprite art mounted at all — not merely hidden.
    expect(imageSources(screen)).toHaveLength(0);
  });

  it("mounts no habitat before the player store has hydrated", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);
    // Absent, not merely transparent or covered.
    expect(habitatSources(screen)).toHaveLength(0);
    expect(habitatSources(screen)).not.toContain(NILLY_HABITAT);
  });

  it("mounts the persisted monster and habitat — never the default — once hydration lands", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    // Before: neither monster nor habitat exists at all.
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
    expect(habitatSources(screen)).toHaveLength(0);

    await completeHydration();

    // After: the very first monster/habitat to mount is Luna's.
    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    expect(screen.getByLabelText("Pet Luna")).toBeTruthy();
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
    expect(habitatSources(screen)).toEqual([LUNA_HABITAT]);
    expect(imageSources(screen)).toContain(LUNA_TEEN);
    expect(imageSources(screen)).not.toContain(NILLY_TEEN);
    expect(imageSources(screen)).not.toContain(NILLY_HABITAT);
  });

  it("keeps the hydrated monster and habitat mounted across unrelated state changes", async () => {
    const screen = render(<HomeScreen />);
    await completeHydration();

    expect(screen.getByLabelText("Pet Luna")).toBeTruthy();
    expect(habitatSources(screen)).toHaveLength(1);

    // Unrelated Home state: collapsing the stat panel must not disturb the
    // gate or remount the habitat.
    act(() => {
      usePlayerStore.getState().toggleStatPanel();
    });
    act(() => {
      usePetStore.setState({ happiness: 80 });
    });

    expect(screen.getByLabelText("Pet Luna")).toBeTruthy();
    expect(habitatSources(screen)).toEqual([LUNA_HABITAT]);
    expect(screen.queryByLabelText("Pet Nilly")).toBeNull();
  });
});
