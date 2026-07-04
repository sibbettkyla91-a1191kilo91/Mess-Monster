import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function DebugSpritesScreen() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText type="title">Debug Sprites</ThemedText>
      <ThemedText style={{ marginTop: 12, opacity: 0.7 }}>Sprite gallery coming soon</ThemedText>
    </ThemedView>
  );
}
