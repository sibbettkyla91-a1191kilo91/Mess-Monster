import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { usePetStore } from '@/store/use-pet-store';
import { usePlayerStore } from '@/store/use-player-store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreItem {
  id: string;
  emoji: string;
  name: string;
  description: string;
  cost: number;
  /** Hours subtracted from "time since last care" — 999 = full reset. */
  moodBoostHours: number;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

const ITEMS: StoreItem[] = [
  { id: '1', emoji: '🍖', name: 'Snack',        cost: 25,  moodBoostHours: 2,   description: 'A tasty treat. Luna purrs… sort of.' },
  { id: '2', emoji: '🧸', name: 'Toy',          cost: 40,  moodBoostHours: 4,   description: 'Playtime! Mood boost incoming.' },
  { id: '3', emoji: '🛁', name: 'Bath',         cost: 30,  moodBoostHours: 3,   description: 'Squeaky clean. Mood improves.' },
  { id: '4', emoji: '💤', name: 'Rest Potion',  cost: 50,  moodBoostHours: 999, description: 'Full reset. Monster fully restored.' },
  { id: '5', emoji: '✨', name: 'Sparkle Dust', cost: 60,  moodBoostHours: 6,   description: 'Extra shimmer for your monster.' },
  { id: '6', emoji: '🌙', name: 'Moon Charm',   cost: 75,  moodBoostHours: 8,   description: "Luna's favorite. Big mood boost." },
  { id: '7', emoji: '🌿', name: 'Garden Snip',  cost: 35,  moodBoostHours: 2,   description: 'Fresh and calm. Small mood lift.' },
  { id: '8', emoji: '🎉', name: 'Party Hat',    cost: 20,  moodBoostHours: 1,   description: 'Silly but effective.' },
];

// ─── Theme ────────────────────────────────────────────────────────────────────

const THEMES = {
  nilly: {
    background:      '#f0faf5',
    headerBg:        '#ffffff',
    headerBorder:    '#d4f0e2',
    accent:          '#52b788',
    text:            '#2d3436',
    subtext:         '#6b7c75',
    pillText:        '#ffffff',
    cardBg:          '#ffffff',
    cardBorder:      '#c8ecd8',
    disabledCardBg:  '#f1f3f2',
    disabledText:    '#b4bcb8',
    toastBg:         '#2d3436',
    toastText:       '#ffffff',
  },
  luna: {
    background:      '#1a1a2e',
    headerBg:        '#1e1e3c',
    headerBorder:    '#2e1e3e',
    accent:          '#cc2222',
    text:            '#f0e6d3',
    subtext:         '#9986a0',
    pillText:        '#f0e6d3',
    cardBg:          '#24243e',
    cardBorder:      '#3a2a4e',
    disabledCardBg:  '#1e1e32',
    disabledText:    '#50506a',
    toastBg:         '#f0e6d3',
    toastText:       '#1a1a2e',
  },
} as const;

type Theme = typeof THEMES.nilly;

// ─── Toast hook ───────────────────────────────────────────────────────────────

function useToast() {
  const [message, setMessage] = useState('');
  const opacity   = useRef(new Animated.Value(0)).current;
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);

  const show = useCallback(
    (msg: string) => {
      // Cancel any running animation then reset opacity
      if (activeAnim.current) {
        activeAnim.current.stop();
        opacity.setValue(0);
      }
      setMessage(msg);

      const anim = Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]);

      activeAnim.current = anim;
      anim.start(({ finished }) => {
        if (finished) setMessage('');
      });
    },
    [opacity],
  );

  return { message, opacity, show };
}

// ─── Item card ────────────────────────────────────────────────────────────────

interface CardProps {
  item: StoreItem;
  canAfford: boolean;
  deficit: number;
  theme: Theme;
  onBuy: (item: StoreItem) => void;
}

function ItemCard({ item, canAfford, deficit, theme, onBuy }: CardProps) {
  return (
    <Pressable
      onPress={() => canAfford && onBuy(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.cost} points${canAfford ? '' : ', cannot afford'}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: canAfford ? theme.cardBg : theme.disabledCardBg,
          borderColor:     canAfford ? theme.cardBorder : 'transparent',
          opacity: pressed && canAfford ? 0.72 : 1,
        },
      ]}
    >
      {/* Emoji */}
      <ThemedText style={styles.cardEmoji}>{item.emoji}</ThemedText>

      {/* Name */}
      <ThemedText
        style={[styles.cardName, { color: canAfford ? theme.text : theme.disabledText }]}
      >
        {item.name}
      </ThemedText>

      {/* Description */}
      <ThemedText
        style={[styles.cardDesc, { color: canAfford ? theme.subtext : theme.disabledText }]}
        numberOfLines={3}
      >
        {item.description}
      </ThemedText>

      {/* Price pill */}
      <View
        style={[
          styles.pricePill,
          { backgroundColor: canAfford ? theme.accent : theme.disabledCardBg },
        ]}
      >
        <ThemedText
          style={[
            styles.priceText,
            { color: canAfford ? theme.pillText : theme.disabledText },
          ]}
        >
          {canAfford ? `⭐ ${item.cost} pts` : `Need ${deficit} more pts`}
        </ThemedText>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StoreScreen() {
  const availablePoints = usePlayerStore((s) => s.availablePoints());
  const spendPoints     = usePlayerStore((s) => s.spendPoints);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? 'nilly';

  const monster = selectedMonster === 'luna' ? 'luna' : 'nilly';
  const theme   = THEMES[monster];

  // Destructure so ESLint can track the stable `show` reference independently
  const { message: toastMessage, opacity: toastOpacity, show: showToast } = useToast();

  const handleBuy = useCallback(
    (item: StoreItem) => {
      const ok = spendPoints(item.cost);
      if (!ok) return;

      // Boost mood by winding the "last cared at" clock forward
      if (item.moodBoostHours >= 999) {
        // Full reset — treat it as if we just cared for the pet right now
        usePetStore.setState({ lastCaredAt: Date.now() });
      } else {
        const current  = usePetStore.getState().lastCaredAt;
        const boostMs  = item.moodBoostHours * 3_600_000;
        // Don't overshoot into the future
        usePetStore.setState({ lastCaredAt: Math.min(Date.now(), current + boostMs) });
      }

      const reaction =
        monster === 'luna'
          ? 'Luna stirs with dark delight…'
          : 'Nilly wiggles with joy!';

      showToast(`${item.emoji} ${item.name} used! ${reaction}`);
    },
    [spendPoints, monster, showToast],
  );

  const renderItem = ({ item }: { item: StoreItem }) => {
    const deficit   = item.cost - availablePoints;
    const canAfford = deficit <= 0;
    return (
      <ItemCard
        item={item}
        canAfford={canAfford}
        deficit={Math.max(0, deficit)}
        theme={theme}
        onBuy={handleBuy}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder },
        ]}
      >
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
          Store
        </ThemedText>
        <View style={[styles.pointsPill, { backgroundColor: theme.accent }]}>
          <ThemedText style={[styles.pointsText, { color: theme.pillText }]}>
            ⭐ {availablePoints} pts
          </ThemedText>
        </View>
      </View>

      {/* ── Grid ── */}
      <FlatList
        data={ITEMS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Toast overlay ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          { backgroundColor: theme.toastBg, opacity: toastOpacity },
        ]}
      >
        <ThemedText style={[styles.toastText, { color: theme.toastText }]}>
          {toastMessage}
        </ThemedText>
      </Animated.View>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pointsPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Grid
  grid: {
    padding: 16,
    paddingBottom: 40,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },

  // Card
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardEmoji: {
    fontSize: 36,
    marginBottom: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  pricePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 22,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
