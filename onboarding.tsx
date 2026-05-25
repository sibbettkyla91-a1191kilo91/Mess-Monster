import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { usePlayerStore } from '@/store/use-player-store';

export default function OnboardingScreen() {
  const router = useRouter();
  const selectMonster = usePlayerStore((s) => s.selectMonster);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster);
  const monsterName = usePlayerStore((s) => s.monsterName);
  const [hydrated, setHydrated] = useState(
    () => usePlayerStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (hydrated) return;
    return usePlayerStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  if (!hydrated) return null;

  // If monster is selected AND named, skip to main app
  if (selectedMonster && monsterName) {
    return <Redirect href="/(tabs)" />;
  }

  // If monster is selected but NOT named, go to naming screen
  if (selectedMonster && !monsterName) {
    return <Redirect href="/naming" />;
  }

  const choose = (monster: 'nilly' | 'luna') => {
    selectMonster(monster);
    router.replace('/naming');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.split}>
        {/* Nilly — left half */}
        <TouchableOpacity
          style={[styles.half, styles.nillyHalf]}
          onPress={() => choose('nilly')}
          activeOpacity={0.82}
        >
          <View style={[styles.placeholder, styles.nillyPlaceholder]}>
            <Text style={styles.placeholderEmoji}>🌿</Text>
          </View>
          <Text style={styles.nillyName}>Nilly</Text>
          <Text style={styles.nillyTagline}>kawaii & clean</Text>
          <View style={[styles.pill, styles.nillyPill]}>
            <Text style={styles.pillText}>Tap to choose</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Luna — right half */}
        <TouchableOpacity
          style={[styles.half, styles.lunaHalf]}
          onPress={() => choose('luna')}
          activeOpacity={0.82}
        >
          <View style={[styles.placeholder, styles.lunaPlaceholder]}>
            <Text style={styles.placeholderEmoji}>🦇</Text>
          </View>
          <Text style={styles.lunaName}>Luna</Text>
          <Text style={styles.lunaTagline}>dark & witchy</Text>
          <View style={[styles.pill, styles.lunaPill]}>
            <Text style={styles.pillText}>Tap to choose</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Title overlay — sits on top of the split */}
      <View style={styles.titleBar} pointerEvents="none">
        <Text style={styles.titleText}>Choose your{'\n'}Monster!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingBottom: 60,
    gap: 10,
  },
  nillyHalf: {
    backgroundColor: '#b8f5c8',
  },
  lunaHalf: {
    backgroundColor: '#0d0118',
  },
  divider: {
    width: 3,
    backgroundColor: '#000',
  },
  placeholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  nillyPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 3,
    borderColor: '#52b788',
  },
  lunaPlaceholder: {
    backgroundColor: 'rgba(150,0,0,0.2)',
    borderWidth: 3,
    borderColor: '#cc2222',
  },
  placeholderEmoji: {
    fontSize: 68,
  },
  nillyName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a5c3a',
    letterSpacing: 1,
  },
  lunaName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#cc2222',
    letterSpacing: 1,
  },
  nillyTagline: {
    fontSize: 13,
    color: '#52b788',
    fontStyle: 'italic',
  },
  lunaTagline: {
    fontSize: 13,
    color: '#a78bfa',
    fontStyle: 'italic',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 6,
  },
  nillyPill: {
    backgroundColor: '#52b788',
  },
  lunaPill: {
    backgroundColor: '#cc2222',
  },
  pillText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  titleBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'android' ? 44 : 60,
    paddingBottom: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
    zIndex: 10,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 36,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
