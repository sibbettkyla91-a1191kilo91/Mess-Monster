import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SubscriptionTier = "free" | "monthly" | "yearly";
export type SubscriptionStatus = "trial" | "active" | "expired" | "none";

interface SubscriptionState {
  // Subscription metadata
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  trialStartedAt: number | null; // unix ms when trial began
  trialExpiresAt: number | null; // unix ms when trial ends (3 days from start)
  subscriptionExpiresAt: number | null; // unix ms when subscription ends
  receiptToken: string | null; // IAP receipt from Google Play
  lastReceiptRefreshAt: number | null; // unix ms of last receipt validation
}

interface SubscriptionStore extends SubscriptionState {
  // Trial management
  startFreeTrial: () => void;
  checkTrialStatus: () => void;
  getTrialDaysRemaining: () => number;

  // Subscription management
  purchaseSubscription: (
    tier: "monthly" | "yearly",
    receiptToken: string,
  ) => void;
  renewSubscription: (receiptToken: string) => void;
  cancelSubscription: () => void;

  isOnTrial: () => boolean;
}

const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      tier: "free",
      status: "none",
      trialStartedAt: null,
      trialExpiresAt: null,
      subscriptionExpiresAt: null,
      receiptToken: null,
      lastReceiptRefreshAt: null,

      // Start the 3-day free trial
      startFreeTrial: () => {
        const now = Date.now();
        const expiresAt = now + TRIAL_DURATION_MS;
        set({
          tier: "free",
          status: "trial",
          trialStartedAt: now,
          trialExpiresAt: expiresAt,
        });
      },

      // Check if trial has expired and update status
      checkTrialStatus: () => {
        const state = get();
        if (state.status !== "trial") return;

        const now = Date.now();
        if (state.trialExpiresAt && now >= state.trialExpiresAt) {
          // Trial expired
          set({
            status: "expired",
          });
        }
      },

      // Get remaining trial days (0 if expired or not on trial)
      getTrialDaysRemaining: () => {
        const state = get();
        if (state.status !== "trial" || !state.trialExpiresAt) return 0;

        const now = Date.now();
        const remainingMs = state.trialExpiresAt - now;
        if (remainingMs <= 0) return 0;

        return Math.ceil(remainingMs / (24 * 60 * 60 * 1000)); // Convert to days
      },

      // Record a subscription purchase
      purchaseSubscription: (
        tier: "monthly" | "yearly",
        receiptToken: string,
      ) => {
        const now = Date.now();
        // Set expiration: 30 days for monthly, 365 days for yearly
        const expirationMs =
          tier === "monthly"
            ? 30 * 24 * 60 * 60 * 1000
            : 365 * 24 * 60 * 60 * 1000;

        set({
          tier,
          status: "active",
          subscriptionExpiresAt: now + expirationMs,
          receiptToken,
          lastReceiptRefreshAt: now,
          // End trial when subscription starts
          trialExpiresAt: null,
        });
      },

      // Renew subscription with new receipt
      renewSubscription: (receiptToken: string) => {
        const state = get();
        if (state.tier === "free") return; // Can't renew free tier

        const now = Date.now();
        const expirationMs =
          state.tier === "monthly"
            ? 30 * 24 * 60 * 60 * 1000
            : 365 * 24 * 60 * 60 * 1000;

        set({
          status: "active",
          subscriptionExpiresAt: now + expirationMs,
          receiptToken,
          lastReceiptRefreshAt: now,
        });
      },

      // Cancel subscription
      cancelSubscription: () => {
        set({
          tier: "free",
          status: "expired",
          subscriptionExpiresAt: null,
          receiptToken: null,
        });
      },

      isOnTrial: () => get().status === "trial",
    }),
    {
      name: "mm-subscription",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

type ForbiddenPremiumKeys =
  | "isPremium"
  | "canUseMusic"
  | "canSkipAds"
  | "canEvolveToAdult"
  | "canUseShortTimer";

type AssertNever<T extends never> = T;
type _SubscriptionHasNoPremiumReader = AssertNever<
  Extract<keyof SubscriptionStore, ForbiddenPremiumKeys>
>;
