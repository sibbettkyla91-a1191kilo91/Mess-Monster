/**
 * Player-store isPremium is the only entitlement. The subscription store
 * keeps trial/receipt scaffolding and must not answer "is this user premium."
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

import { isPlayerPremium } from "@/store/premium";
import { usePlayerStore } from "@/store/use-player-store";
import { usePetStore } from "@/store/use-pet-store";
import { useSubscriptionStore } from "@/store/use-subscription-store";

const FORBIDDEN_SUB_READERS = [
  "isPremium",
  "canUseMusic",
  "canSkipAds",
  "canEvolveToAdult",
  "canUseShortTimer",
] as const;

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

describe("single premium source", () => {
  it("does not expose premium readers on the subscription store", () => {
    const sub = useSubscriptionStore.getState() as Record<string, unknown>;
    for (const key of FORBIDDEN_SUB_READERS) {
      expect(sub[key]).toBeUndefined();
    }
  });

  it("isPlayerPremium matches the player-store flag only", () => {
    expect(isPlayerPremium()).toBe(false);
    usePlayerStore.getState().setPremium(true);
    expect(isPlayerPremium()).toBe(true);
    usePlayerStore.getState().setPremium(false);
    expect(isPlayerPremium()).toBe(false);
  });

  it("setPremium(true) is what evolves an eligible teen", () => {
    usePlayerStore.getState().setPremium(true);
    expect(isPlayerPremium()).toBe(true);

    usePetStore.getState().recheckEvolution();
    expect(usePetStore.getState().evolutionStage).toBe("adult");
    expect(usePetStore.getState().pendingEvolution).toBe("adult");
  });

  it("setPremium(false) leaves an eligible teen ungated-but-not-evolved", () => {
    usePlayerStore.getState().setPremium(true);
    usePlayerStore.getState().setPremium(false);
    expect(isPlayerPremium()).toBe(false);

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

    expect(isPlayerPremium()).toBe(false);
    expect(useSubscriptionStore.getState().isOnTrial()).toBe(true);

    usePetStore.getState().recheckEvolution();
    expect(usePetStore.getState().evolutionStage).toBe("teen");
  });

  it("subscription active status alone cannot grant premium", () => {
    useSubscriptionStore.setState({
      tier: "monthly",
      status: "active",
      receiptToken: "tok",
      subscriptionExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    expect(isPlayerPremium()).toBe(false);

    usePetStore.getState().recheckEvolution();
    expect(usePetStore.getState().evolutionStage).toBe("teen");
  });
});
