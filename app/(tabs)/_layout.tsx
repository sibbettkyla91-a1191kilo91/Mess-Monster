import { Redirect, Tabs } from "expo-router";
import React, { useMemo } from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { useMonsterTheme } from "@/hooks/use-monster-theme";
import { usePlayerStore } from "@/store/use-player-store";

/** Cheapest item in the store. Badge hides below this. */
const MIN_STORE_ITEM_COST = 20;

export default function TabLayout() {
  // Derived primitive selector — re-renders only when the balance changes.
  const availablePoints = usePlayerStore((s) => s.totalPoints - s.spentPoints);
  const hasCompletedOnboarding = usePlayerStore(
    (s) => s.hasCompletedOnboarding,
  );
  const playerHydrated = useHasHydrated(usePlayerStore);
  const { tabTint, chrome, line, inkMuted } = useMonsterTheme();

  // PERFORMANCE: Memoize the badge value to prevent tab options recalculation on every render
  const storeBadge = useMemo(
    () => (availablePoints >= MIN_STORE_ITEM_COST ? ("" as const) : undefined),
    [availablePoints],
  );

  // Empty-string badge renders as a coloured dot; undefined hides it entirely

  // A native cold start opens at "/", which resolves to these tabs — the
  // root layout's `anchor: "onboarding"` only stacks onboarding *underneath*
  // them. The monster choice is made exactly once, here, so the tabs must
  // send a player who has not finished onboarding there themselves. The
  // flag is persisted: decide only from hydrated state, never the default.
  if (!playerHydrated) return null;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tabTint,
        tabBarInactiveTintColor: inkMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: chrome,
          borderTopColor: line,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="checklist" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Store",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="bag.fill" color={color} />
          ),
          tabBarBadge: storeBadge,
          tabBarBadgeStyle: { backgroundColor: tabTint },
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: "Collection",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="sparkles" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="debug-sprites"
        options={{
          href: __DEV__ ? undefined : null,
          title: "Tune",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="ladybug" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
