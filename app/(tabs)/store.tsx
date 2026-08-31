import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { useMonsterTheme } from "@/hooks/use-monster-theme";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { executePaidShopPurchase } from "@/store/recover-unsettled-purchases";
import { useStoreStore } from "@/store/use-store-store";
import {
  STORE_CATEGORIES,
  STORE_ITEMS,
  StoreCategory,
  StoreItem,
} from "@/store/store-items";

const fontRounded = Platform.select({
  ios: "ui-rounded",
  android: "sans-serif-medium",
  default: "system-ui",
});

export default function StoreScreen() {
  const availablePoints = usePlayerStore((s) => s.totalPoints - s.spentPoints);
  const care = usePetStore((s) => s.care);
  const isOwned = useStoreStore((s) => s.isOwned);
  const consumeItem = useStoreStore((s) => s.useItem);
  const owned = useStoreStore((s) => s.owned);
  // handleBuy writes to all three persisted stores; a purchase made before
  // AsyncStorage rehydration completes gets clobbered when the hydration
  // merge lands, so the shop stays closed until every store is hydrated.
  const storeHydrated = useHasHydrated(useStoreStore);
  const playerHydrated = useHasHydrated(usePlayerStore);
  const petHydrated = useHasHydrated(usePetStore);
  const hydrated = storeHydrated && playerHydrated && petHydrated;
  const {
    accent,
    accentInk,
    accentSoft,
    onSoft,
    page,
    surface,
    surfaceRaised,
    ink,
    inkMuted,
    line,
    monster,
  } = useMonsterTheme();

  const [activeCategory, setActiveCategory] = useState<StoreCategory>("food");
  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const showFeedback = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFeedback(message);
    timerRef.current = setTimeout(() => setFeedback(null), 2200);
  }, []);

  const handleBuy = useCallback(
    (item: StoreItem) => {
      // Backstop for the render gate below: never write to a store that
      // hasn't finished rehydrating, or the write gets clobbered.
      if (!hydrated) return;

      // Check if non-repeatable and already owned
      if (!item.repeatable && isOwned(item.id)) {
        showFeedback("\u2705 Already owned!");
        return;
      }

      // Repeatable items: use a gifted unit from inventory first (free items
      // won from photo rewards) before charging any points.
      if (item.repeatable && (owned[item.id]?.quantity ?? 0) > 0) {
        consumeItem(item.id);
        care();
        showFeedback(`\ud83c\udf81 ${item.name} used from your gifts!`);
        return;
      }

      // Check if player can afford it
      if (availablePoints < item.price) {
        showFeedback("\ud83d\ude05 Not enough points!");
        return;
      }

      // Grant the item before charging: if the app is killed between the
      // two writes, the player keeps the item rather than losing points
      // with nothing to show for it. Recovery never retroactively charges.
      const bought = executePaidShopPurchase(item);
      if (!bought) {
        showFeedback("\u274c Something went wrong");
        return;
      }

      // For food (the only repeatable category), auto-use is part of the
      // paid purchase transaction. Toys, accessories, and decor stay in
      // the collection.
      if (item.repeatable) {
        showFeedback(`\ud83c\udf89 ${item.name} used! +${item.moodBoost} mood`);
      } else {
        showFeedback(`\ud83d\udecd\ufe0f ${item.name} added to collection!`);
      }
    },
    [
      hydrated,
      availablePoints,
      isOwned,
      consumeItem,
      care,
      showFeedback,
      owned,
    ],
  );

  const filteredItems = STORE_ITEMS.filter(
    (i) => i.category === activeCategory,
  );

  const isLuna = monster === "luna";
  const cardLift = isLuna
    ? null
    : {
        shadowColor: ink,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      };

  const pressScale = (pressed: boolean) =>
    reduceMotion ? 1 : pressed ? 0.98 : 1;

  return (
    <View style={[styles.container, { backgroundColor: page }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: ink, fontFamily: fontRounded }]}>
          Points Store
        </Text>
        <View style={[styles.pointsBadge, { backgroundColor: accentSoft }]}>
          <Text
            style={[
              styles.pointsBadgeText,
              { color: onSoft, fontFamily: fontRounded },
            ]}
          >
            {availablePoints} pts
          </Text>
        </View>
      </View>

      {feedback && (
        <View style={[styles.feedbackPill, { backgroundColor: accentSoft }]}>
          <Text style={[styles.feedbackText, { color: onSoft }]}>
            {feedback}
          </Text>
        </View>
      )}

      <View style={styles.categoryRow}>
        {STORE_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              style={({ pressed }) => [
                styles.categoryTab,
                {
                  backgroundColor: active ? accentSoft : surface,
                  borderColor: active ? accentSoft : line,
                  opacity: pressed ? 0.88 : 1,
                  transform: [{ scale: pressScale(pressed) }],
                },
              ]}
              onPress={() => setActiveCategory(cat.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={cat.label}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  { color: active ? onSoft : inkMuted },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Items grid — held behind a brief loading moment on cold start so a
          fast tap can't land before persisted purchases finish loading. */}
      {!hydrated ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={accent} />
          <Text style={[styles.loadingText, { color: inkMuted }]}>
            Opening the shop…
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.itemsGrid}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.map((item) => {
            const ownedForever = !item.repeatable && isOwned(item.id);
            const giftCount = item.repeatable
              ? (owned[item.id]?.quantity ?? 0)
              : 0;
            const canAfford = availablePoints >= item.price;
            const canPress = canAfford || giftCount > 0;

            return (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: ownedForever ? surface : surfaceRaised,
                    borderColor: line,
                    opacity: ownedForever ? 0.72 : 1,
                  },
                  cardLift,
                ]}
              >
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <Text
                  style={[
                    styles.itemName,
                    {
                      color: ownedForever ? inkMuted : ink,
                      fontFamily: fontRounded,
                    },
                  ]}
                >
                  {item.name}
                </Text>
                <Text style={[styles.itemDesc, { color: inkMuted }]}>
                  {item.description}
                </Text>

                <View style={styles.itemFooter}>
                  {giftCount > 0 && (
                    <View
                      style={[
                        styles.giftBadge,
                        { backgroundColor: accentSoft },
                      ]}
                    >
                      <Text style={[styles.giftText, { color: onSoft }]}>
                        {giftCount} gift{giftCount > 1 ? "s" : ""} ready
                      </Text>
                    </View>
                  )}
                  {ownedForever ? (
                    <View
                      style={[
                        styles.ownedBadge,
                        { backgroundColor: accentSoft },
                      ]}
                    >
                      <Text style={[styles.ownedText, { color: onSoft }]}>
                        Owned
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.buyButton,
                        {
                          backgroundColor: canPress ? accent : line,
                          opacity: pressed && canPress ? 0.88 : 1,
                          transform: [
                            { scale: canPress ? pressScale(pressed) : 1 },
                          ],
                        },
                      ]}
                      onPress={() => handleBuy(item)}
                      disabled={!canPress}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !canPress }}
                      accessibilityLabel={
                        giftCount > 0
                          ? "Use a gift, free"
                          : `${item.repeatable ? "Use" : "Buy"} ${item.price} points`
                      }
                    >
                      <Text
                        style={[
                          styles.buyButtonText,
                          {
                            color: canPress ? accentInk : inkMuted,
                            fontFamily: fontRounded,
                          },
                        ]}
                      >
                        {giftCount > 0
                          ? "Use a gift · free"
                          : `${item.repeatable ? "Use" : "Buy"} · ${item.price} pts`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 54,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  pointsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pointsBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  feedbackPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "center",
    marginBottom: 12,
  },
  feedbackText: {
    fontWeight: "700",
    fontSize: 13,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  categoryTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  itemsGrid: {
    gap: 12,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 80,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 4,
  },
  itemEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
  },
  itemDesc: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 10,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  giftBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: "auto",
  },
  giftText: {
    fontWeight: "600",
    fontSize: 12,
  },
  buyButton: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 132,
  },
  buyButtonText: {
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  ownedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ownedText: {
    fontWeight: "600",
    fontSize: 12,
  },
});
