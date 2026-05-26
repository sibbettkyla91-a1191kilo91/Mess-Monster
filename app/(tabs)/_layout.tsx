import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEFAULT_PALETTE, LUNA_PALETTE, NILLY_PALETTE } from '@/monster-theme';
import { usePlayerStore } from '@/store/use-player-store';

export default function TabLayout() {
  const selectedMonster = usePlayerStore((s) => s.selectedMonster);

  const tabTint =
    selectedMonster === 'luna'  ? LUNA_PALETTE.tabTint :
    selectedMonster === 'nilly' ? NILLY_PALETTE.tabTint :
    DEFAULT_PALETTE.tabTint;

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
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'Store',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bag.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
