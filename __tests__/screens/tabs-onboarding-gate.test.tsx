/**
 * A native cold start opens at "/", which expo-router resolves to the tab
 * group; the root layout's `anchor: "onboarding"` only stacks onboarding
 * underneath it. The monster choice is made exactly once, in onboarding, so
 * the tabs themselves must send a player who has not finished it there —
 * and must decide that from hydrated state, never from the default flag.
 */
import { act, render } from "@testing-library/react-native";

import TabLayout from "@/app/(tabs)/_layout";
import { usePlayerStore } from "@/store/use-player-store";

type Resolvers = Record<string, (value: string | null) => void>;

type Holder = typeof globalThis & {
  __mmTabGateResolvers?: Resolvers;
  __mmTabGateRedirects?: string[];
};

const holder = globalThis as Holder;
holder.__mmTabGateResolvers ??= {};
holder.__mmTabGateRedirects ??= [];

// Deferred AsyncStorage keyed by persist name — see home-hydration-gate.
jest.mock("@react-native-async-storage/async-storage", () => {
  const h = globalThis as Holder;
  h.__mmTabGateResolvers ??= {};
  const resolvers = h.__mmTabGateResolvers;
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

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  const h = globalThis as Holder;
  h.__mmTabGateRedirects ??= [];
  function Tabs() {
    return <Text testID="tabs">tabs</Text>;
  }
  Tabs.Screen = function TabsScreen() {
    return null;
  };
  function Redirect({ href }: { href: string }) {
    h.__mmTabGateRedirects!.push(href);
    return null;
  }
  return { Tabs, Redirect };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

const COMPLETED_SAVE = JSON.stringify({
  state: {
    totalPoints: 100,
    spentPoints: 0,
    streak: 0,
    lastActiveDay: "",
    activeDaysCount: 0,
    isPremium: false,
    selectedMonster: "luna",
    monsterName: "Mistletoe",
    hasCompletedOnboarding: true,
  },
  version: 6,
});

const UNFINISHED_SAVE = JSON.stringify({
  state: {
    selectedMonster: null,
    monsterName: "",
    hasCompletedOnboarding: false,
  },
  version: 6,
});

const redirects = () => holder.__mmTabGateRedirects!;

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function resolvePlayer(save: string | null) {
  await act(async () => {
    holder.__mmTabGateResolvers!["mm-player"]?.(save);
    await flushHydration();
  });
}

/**
 * Put the singleton store back into "rehydration in flight": defaults in
 * memory, hasHydrated() false, a fresh deferred getItem waiting on a test.
 */
beforeEach(() => {
  holder.__mmTabGateRedirects = [];
  delete holder.__mmTabGateResolvers!["mm-player"];
  usePlayerStore.setState({
    selectedMonster: null,
    monsterName: "",
    hasCompletedOnboarding: false,
    totalPoints: 0,
    spentPoints: 0,
  });
  void usePlayerStore.persist.rehydrate();
});

describe("Tabs onboarding gate", () => {
  it("renders neither the tabs nor a redirect before the player store hydrates", async () => {
    const screen = render(<TabLayout />);
    await act(async () => {
      await flushHydration();
    });

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);
    expect(screen.queryByTestId("tabs")).toBeNull();
    expect(redirects()).toEqual([]);
  });

  it("sends a brand-new install to onboarding once hydration lands on the defaults", async () => {
    const screen = render(<TabLayout />);
    await resolvePlayer(null);

    expect(usePlayerStore.persist.hasHydrated()).toBe(true);
    expect(usePlayerStore.getState().hasCompletedOnboarding).toBe(false);
    expect(redirects()).toEqual(["/onboarding"]);
    expect(screen.queryByTestId("tabs")).toBeNull();
  });

  it("sends a player who backgrounded mid-onboarding back to finish it", async () => {
    const screen = render(<TabLayout />);
    await resolvePlayer(UNFINISHED_SAVE);

    expect(redirects()).toEqual(["/onboarding"]);
    expect(screen.queryByTestId("tabs")).toBeNull();
  });

  it("shows the tabs, with no redirect, for a player who already chose a monster", async () => {
    const screen = render(<TabLayout />);
    await resolvePlayer(COMPLETED_SAVE);

    expect(redirects()).toEqual([]);
    expect(screen.getByTestId("tabs")).toBeTruthy();
    expect(usePlayerStore.getState().selectedMonster).toBe("luna");
  });

  it("drops the redirect and shows the tabs the moment onboarding completes", async () => {
    const screen = render(<TabLayout />);
    await resolvePlayer(UNFINISHED_SAVE);
    expect(redirects()).toEqual(["/onboarding"]);

    act(() => {
      usePlayerStore.getState().selectMonster("nilly");
      usePlayerStore.getState().setMonsterName("Pip");
      usePlayerStore.getState().completeOnboarding();
    });

    expect(screen.getByTestId("tabs")).toBeTruthy();
    // Nothing besides the one pre-completion redirect was ever emitted.
    expect(redirects()).toEqual(["/onboarding"]);
  });
});
