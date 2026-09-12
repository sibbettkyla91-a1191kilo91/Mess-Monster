import * as Haptics from "expo-haptics";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? "nilly";
  const isOwned = useStoreStore((s) => s.isOwned);
  const owned = useStoreStore((s) => s.byMonster[selectedMonster].owned);
  const equipped = useStoreStore((s) => s.byMonster[selectedMonster].equipped);
  // handleBuy writes to all three persisted stores; a purchase made before
  // AsyncStorage rehydration completes gets clobbered when the hydration
  // merge lands, so the shop stays closed until every store is hydrated.
  const storeHydrated = useHasHydrated(useStoreStore);
  const playerHydrated = useHasHydrated(usePlayerStore);
  const petHydrated = useHasHydrated(usePetStore);
  const hydrated = storeHydrated && playerHydrated && petHydrated;
  const insets = useSafeAreaInsets();
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
        showFeedback("Already in the collection.");
        return;
      }

      // Check if player can afford it
      if (availablePoints < item.price) {
        showFeedback("Not enough points yet.");
        return;
      }

      // Grant the item before charging: if the app is killed between the
      // two writes, the player keeps the item rather than losing points
      // with nothing to show for it. Recovery never retroactively charges.
      // Food goes into this monster's bag and is used later from Home.
      const bought = executePaidShopPurchase(item);
      if (!bought) {
        showFeedback("Something went wrong.");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (item.repeatable) {
        showFeedback(`${item.name} — in the bag.`);
      } else {
        showFeedback(`${item.name} is theirs now.`);
      }
    },
    [hydrated, availablePoints, isOwned, showFeedback],
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
    <View
      style={[
        styles.container,
        { backgroundColor: page, paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: ink, fontFamily: fontRounded }]}>
          The Shop
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
            const bagCount = item.repeatable
              ? (owned[item.id]?.quantity ?? 0)
              : 0;
            const canAfford = availablePoints >= item.price;
            const canPress = canAfford;
            const isEquipped =
              !item.repeatable &&
              !!equipped &&
              Object.values(equipped).includes(item.id);
            const lockedLook = !ownedForever && !canPress;

            return (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor:
                      ownedForever || isEquipped ? surface : surfaceRaised,
                    borderColor: isEquipped ? accent : line,
                    opacity: lockedLook ? 0.58 : ownedForever ? 0.88 : 1,
                  },
                  cardLift,
                ]}
              >
                <View style={styles.cardTop}>
                  <View
                    style={[styles.emojiWell, { backgroundColor: accentSoft }]}
                  >
                    <Text style={styles.itemEmoji}>{item.emoji}</Text>
                  </View>
                  {isEquipped ? (
                    <View
                      style={[styles.stateChip, { backgroundColor: accent }]}
                    >
                      <Text style={[styles.stateChipText, { color: accentInk }]}>
                        Equipped
                      </Text>
                    </View>
                  ) : ownedForever ? (
                    <View
                      style={[styles.stateChip, { backgroundColor: accentSoft }]}
                    >
                      <Text style={[styles.stateChipText, { color: onSoft }]}>
                        Owned
                      </Text>
                    </View>
                  ) : lockedLook ? (
                    <View
                      style={[
                        styles.stateChip,
                        { backgroundColor: surface, borderColor: line, borderWidth: 1 },
                      ]}
                    >
                      <Text style={[styles.stateChipText, { color: inkMuted }]}>
                        {item.price} pts
                      </Text>
                    </View>
                  ) : null}
                </View>
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
                  {bagCount > 0 && (
                    <View
                      style={[
                        styles.giftBadge,
                        { backgroundColor: accentSoft },
                      ]}
                    >
                      <Text style={[styles.giftText, { color: onSoft }]}>
                        {bagCount} in the bag
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
                        {isEquipped ? "On them" : "In collection"}
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
                      accessibilityLabel={`Buy ${item.name}, ${item.price} points`}
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
                        {`Buy · ${item.price} pts`}
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
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  emojiWell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  itemEmoji: {
    fontSize: 28,
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  stateChipText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
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
