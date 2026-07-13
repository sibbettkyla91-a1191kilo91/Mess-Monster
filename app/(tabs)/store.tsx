import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { useMonsterTheme } from "@/hooks/use-monster-theme";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";
import {
  STORE_CATEGORIES,
  STORE_ITEMS,
  StoreCategory,
  StoreItem,
} from "@/store/store-items";

export default function StoreScreen() {
  const availablePoints = usePlayerStore((s) => s.totalPoints - s.spentPoints);
  const spendPoints = usePlayerStore((s) => s.spendPoints);
  const care = usePetStore((s) => s.care);
  const buyItem = useStoreStore((s) => s.buyItem);
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
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const {
    accent,
    accentLight,
    accentDark,
    text: accentText,
  } = useMonsterTheme();

  const [activeCategory, setActiveCategory] = useState<StoreCategory>("food");
  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // with nothing to show for it.
      const bought = buyItem(item);
      if (!bought) {
        showFeedback("\u274c Something went wrong");
        return;
      }

      // Affordability was checked above; if points shifted underneath us
      // the item stays granted \u2014 the failure mode always favors the player.
      spendPoints(item.price);

      // For food and toys, auto-use immediately (they boost mood)
      if (item.repeatable) {
        consumeItem(item.id);
        // Apply mood boost by calling care (resets lastCaredAt)
        care();
        showFeedback(`\ud83c\udf89 ${item.name} used! +${item.moodBoost} mood`);
      } else {
        showFeedback(`\ud83d\udecd\ufe0f ${item.name} added to collection!`);
      }
    },
    [
      hydrated,
      availablePoints,
      spendPoints,
      buyItem,
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

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title">Points Store</ThemedText>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsBadgeText}>
            {"\u2b50"} {availablePoints} pts
          </Text>
        </View>
      </View>

      {/* Feedback pill */}
      {feedback && (
        <View
          style={[
            styles.feedbackPill,
            { backgroundColor: isDark ? accentDark : accentLight },
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              { color: isDark ? accentLight : accentText },
            ]}
          >
            {feedback}
          </Text>
        </View>
      )}

      {/* Category tabs */}
      <View style={styles.categoryRow}>
        {STORE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryTab,
              isDark && styles.categoryTabDark,
              activeCategory === cat.key && {
                backgroundColor: isDark ? accentDark : accentLight,
              },
            ]}
            onPress={() => setActiveCategory(cat.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text
              style={[
                styles.categoryLabel,
                isDark && styles.categoryLabelDark,
                activeCategory === cat.key && { color: accentText },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Items grid — held behind a brief loading moment on cold start so a
          fast tap can't land before persisted purchases finish loading. */}
      {!hydrated ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={accent} />
          <ThemedText style={styles.loadingText}>Opening the shop…</ThemedText>
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

            return (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  isDark ? styles.itemCardDark : styles.itemCardLight,
                  ownedForever && styles.itemCardOwned,
                ]}
              >
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                <ThemedText style={styles.itemDesc}>
                  {item.description}
                </ThemedText>

                <View style={styles.itemFooter}>
                  {giftCount > 0 && (
                    <View
                      style={[
                        styles.giftBadge,
                        { backgroundColor: isDark ? accentDark : accentLight },
                      ]}
                    >
                      <Text style={[styles.giftText, { color: accentText }]}>
                        {"🎁"} {giftCount} gift
                        {giftCount > 1 ? "s" : ""} ready
                      </Text>
                    </View>
                  )}
                  {ownedForever ? (
                    <View
                      style={[
                        styles.ownedBadge,
                        { backgroundColor: isDark ? accentDark : accentLight },
                      ]}
                    >
                      <Text style={[styles.ownedText, { color: accentText }]}>
                        {"\u2713"} Owned
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.buyButton,
                        { backgroundColor: accent },
                        !canAfford &&
                          giftCount === 0 &&
                          styles.buyButtonDisabled,
                      ]}
                      onPress={() => handleBuy(item)}
                      activeOpacity={0.7}
                      disabled={!canAfford && giftCount === 0}
                    >
                      <Text
                        style={[
                          styles.buyButtonText,
                          !canAfford &&
                            giftCount === 0 &&
                            styles.buyButtonTextDisabled,
                        ]}
                      >
                        {giftCount > 0
                          ? "\ud83c\udf81 Use a gift \u00b7 free"
                          : `${item.repeatable ? "\ud83c\udf74 Use" : "\ud83d\uded2 Buy"} \u00b7 ${item.price} pts`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pointsBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
  },
  feedbackPill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "center",
    marginBottom: 10,
  },
  feedbackText: {
    fontWeight: "600",
    fontSize: 14,
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
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    gap: 2,
  },
  categoryTabDark: {
    backgroundColor: "#1e2124",
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  categoryLabelDark: {
    color: "#aaa",
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
    opacity: 0.6,
  },
  itemCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  itemCardLight: {
    backgroundColor: "#fafafa",
    borderColor: "#e8e8e8",
  },
  itemCardDark: {
    backgroundColor: "#1e2124",
    borderColor: "#2e3236",
  },
  itemCardOwned: {
    opacity: 0.7,
  },
  itemEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  itemName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 12,
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
    borderRadius: 10,
    marginRight: "auto",
  },
  giftText: {
    fontWeight: "600",
    fontSize: 12,
  },
  buyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buyButtonDisabled: {
    backgroundColor: "#ccc",
  },
  buyButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  buyButtonTextDisabled: {
    color: "#888",
  },
  ownedBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ownedText: {
    fontWeight: "700",
    fontSize: 13,
  },
});
