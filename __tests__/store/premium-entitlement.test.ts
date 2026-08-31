/**
 * P1-7: player isPremium is the only app entitlement. Subscription status,
 * trial, and receipts must not make any current premium reader disagree.
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

import { usePlayerStore } from "@/store/use-player-store";
import { usePetStore } from "@/store/use-pet-store";
import { useSubscriptionStore } from "@/store/use-subscription-store";

function entitlementReaders() {
  const sub = useSubscriptionStore.getState();
  return {
    player: usePlayerStore.getState().isPremium,
    isPremium: sub.isPremium(),
    canUseMusic: sub.canUseMusic(),
    canSkipAds: sub.canSkipAds(),
    canEvolveToAdult: sub.canEvolveToAdult(),
    canUseShortTimer: sub.canUseShortTimer(),
  };
}

function expectAllReaders(value: boolean) {
  const r = entitlementReaders();
  expect(r.player).toBe(value);
  expect(r.isPremium).toBe(value);
  expect(r.canUseMusic).toBe(value);
  expect(r.canSkipAds).toBe(value);
  expect(r.canEvolveToAdult).toBe(value);
  expect(r.canUseShortTimer).toBe(value);
}

function seedAdultEligibleTeen() {
  const now = Date.now();
  usePetStore.setState({
    health: 100,
    happiness: 100,
    lastCaredAt: now,
    lastSessionAt: now,
    evolutionStage: "teen",
    totalPointsEarned: 600,
    adultVariant: "base",
    categoryCompletions: { kitchen: 12, bathroom: 3 },
    claimedStreakMilestones: [],
    pendingMilestoneBanner: null,
    pendingEvolution: null,
    pendingPremiumGate: null,
    premiumGateShownFor: "adult",
  });
  usePlayerStore.setState({ activeDaysCount: 20 });
}

beforeEach(() => {
  usePlayerStore.setState({
    totalPoints: 100,
    spentPoints: 0,
    streak: 0,
    lastActiveDay: "",
    activeDaysCount: 0,
    isPremium: false,
    selectedMonster: null,
    monsterName: "",
    hasCompletedOnboarding: false,
    appliedRewardGrants: {},
  });
  useSubscriptionStore.setState({
    tier: "free",
    status: "none",
    trialStartedAt: null,
    trialExpiresAt: null,
    subscriptionExpiresAt: null,
    receiptToken: null,
    lastReceiptRefreshAt: null,
  });
  seedAdultEligibleTeen();
});

describe("P1-7 player isPremium is the only entitlement", () => {
  it("defaults to non-premium across every current reader", () => {
    expectAllReaders(false);
  });

  it("setPremium(true) makes every current reader report premium", () => {
    usePlayerStore.getState().setPremium(true);
    expectAllReaders(true);

    usePetStore.getState().recheckEvolution();
    expect(usePetStore.getState().evolutionStage).toBe("adult");
    expect(usePetStore.getState().pendingEvolution).toBe("adult");
  });

  it("setPremium(false) makes every current reader report non-premium", () => {
    usePlayerStore.getState().setPremium(true);
    expectAllReaders(true);

    usePlayerStore.getState().setPremium(false);
    expectAllReaders(false);

    usePetStore.getState().recheckEvolution();
    expect(usePetStore.getState().evolutionStage).toBe("teen");
    expect(usePetStore.getState().pendingEvolution).toBeNull();
  });

  it("subscription trial status alone cannot grant premium", () => {
    useSubscriptionStore.setState({
      status: "trial",
      trialStartedAt: Date.now(),
      trialExpiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
    });

    expect(usePlayerStore.getState().isPremium).toBe(false);
    expectAllReaders(false);
    expect(useSubscriptionStore.getState().isOnTrial()).toBe(true);

    usePetStore.getState().recheckEvolution();
    expect(usePetStore.getState().evolutionStage).toBe("teen");
  });

  it("subscription store has no accept-all receipt validator", () => {
    expect(useSubscriptionStore.getState()).not.toHaveProperty(
      "validateReceipt",
    );
  });

  it("subscription active status alone cannot grant premium", () => {
    useSubscriptionStore.setState({
      tier: "monthly",
      status: "active",
      receiptToken: "tok",
      subscriptionExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    expect(usePlayerStore.getState().isPremium).toBe(false);
    expectAllReaders(false);

    usePetStore.getState().recheckEvolution();
    expect(usePetStore.getState().evolutionStage).toBe("teen");
  });
});
