import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useMonsterTheme } from '@/hooks/use-monster-theme';
import { usePlayerStore } from '@/store/use-player-store';

/** Cheapest item in the store. Badge hides below this. */
const MIN_STORE_ITEM_COST = 20;

export default function TabLayout() {
  // PERFORMANCE: Select the computed availablePointsValue instead of calling the function.
  // This prevents unnecessary re-renders when other store values change.
  const availablePoints = usePlayerStore((s) => s.availablePointsValue);
  const { tabTint } = useMonsterTheme();

  // PERFORMANCE: Memoize the badge value to prevent tab options recalculation on every render
  const storeBadge = useMemo(
    () => (availablePoints >= MIN_STORE_ITEM_COST ? ('' as const) : undefined),
    [availablePoints]
  );

  // Empty-string badge renders as a coloured dot; undefined hides it entirely

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tabTint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'Store',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bag.fill" color={color} />,
          tabBarBadge: storeBadge,
          tabBarBadgeStyle: { backgroundColor: tabTint },
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
        }}
      />
      {__DEV__ && (
        <Tabs.Screen
          name="debug-sprites"
          options={{
            title: 'Sprites',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="ladybug" color={color} />,
          }}
        />
      )}
    </Tabs>
  );
}
