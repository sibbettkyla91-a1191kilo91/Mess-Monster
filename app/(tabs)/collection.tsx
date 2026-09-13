import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { useMonsterTheme } from "@/hooks/use-monster-theme";
import {
  ACCESSORY_SLOTS,
  AccessorySlot,
  getAccessoryDef,
  isAccessorySlotLocked,
} from "@/store/accessory-config";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";

const SLOT_LABEL: Record<AccessorySlot, string> = {
  head: "Head",
  face: "Face",
  neck: "Neck",
};

export default function CollectionScreen() {
  const owned = useStoreStore((s) => s.owned);
  const placed = useStoreStore((s) => s.placed);
  const equipped = useStoreStore((s) => s.equipped);
  const togglePlaced = useStoreStore((s) => s.togglePlaced);
  const equipAccessory = useStoreStore((s) => s.equipAccessory);
  const unequipSlot = useStoreStore((s) => s.unequipSlot);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? "nilly";
  const storeHydrated = useHasHydrated(useStoreStore);
  const playerHydrated = useHasHydrated(usePlayerStore);
  const hydrated = storeHydrated && playerHydrated;
  const insets = useSafeAreaInsets();
  const containerStyle = [styles.container, { paddingTop: insets.top + 14 }];

  const ownedItems = useMemo(
    () => Object.values(owned).filter((e) => e.quantity > 0),
    [owned],
  );
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const {
    accent,
    accentLight,
    accentDark,
    text: accentText,
  } = useMonsterTheme();

  const collectionItems = ownedItems.filter((entry) => !entry.item.repeatable);
  const hasItems = collectionItems.length > 0;

  const wearingBySlot = useMemo(() => {
    const lines: { slot: AccessorySlot; name: string }[] = [];
    for (const slot of ACCESSORY_SLOTS) {
      const id = equipped?.[slot];
      if (!id) continue;
      const name = owned[id]?.item.name ?? id;
      lines.push({ slot, name });
    }
    return lines;
  }, [equipped, owned]);

  if (!hydrated) {
    return (
      <ThemedView style={containerStyle}>
        <View style={styles.header}>
          <ThemedText type="title">My Collection</ThemedText>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={accent} />
          <ThemedText style={styles.loadingText}>
            Opening collection…
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={containerStyle}>
      <View style={styles.header}>
        <ThemedText type="title">My Collection</ThemedText>
        {wearingBySlot.length > 0 && (
          <ThemedText style={styles.wearingSummary}>
            Wearing:{" "}
            {wearingBySlot
              .map((row) => `${SLOT_LABEL[row.slot]} · ${row.name}`)
              .join("  ")}
          </ThemedText>
        )}
      </View>

      {hasItems ? (
        <ScrollView
          contentContainerStyle={styles.itemsGrid}
          showsVerticalScrollIndicator={false}
        >
          {collectionItems.map((entry) => {
            const { item } = entry;
            const isPlaceable =
              item.category === "decor" || item.category === "toys";
            const isPlaced = !!placed[item.id];
            const acc = getAccessoryDef(item.id);
            const isAccessory = item.category === "accessories" && !!acc;
            const isWorn = !!acc && equipped?.[acc.slot] === item.id;
            const headLocked =
              !!acc && isAccessorySlotLocked(selectedMonster, acc.slot);

            return (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  isDark ? styles.itemCardDark : styles.itemCardLight,
                ]}
              >
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                <ThemedText style={styles.itemDesc}>
                  {item.description}
                </ThemedText>
                {isAccessory && acc && (
                  <ThemedText style={styles.slotHint}>
                    {SLOT_LABEL[acc.slot]} slot
                    {isWorn ? " · on your monster" : ""}
                  </ThemedText>
                )}

                <View style={styles.itemFooter}>
                  {isPlaceable && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.placeButton,
                        isPlaced
                          ? { backgroundColor: accent }
                          : {
                              borderWidth: 1.5,
                              borderColor: accent,
                            },
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        togglePlaced(item.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isPlaced
                          ? `Remove ${item.name} from the room`
                          : `Place ${item.name} in the room`
                      }
                    >
                      <Text
                        style={[
                          styles.placeButtonText,
                          { color: isPlaced ? accentText : accent },
                        ]}
                      >
                        {isPlaced ? "In the room \u2713" : "Place in room"}
                      </Text>
                    </Pressable>
                  )}
                  {isAccessory && acc && headLocked && (
                    <View
                      style={[
                        styles.placeButton,
                        { borderWidth: 1.5, borderColor: accent, opacity: 0.7 },
                      ]}
                      accessibilityRole="text"
                      accessibilityLabel={`${item.name} coming soon for Luna`}
                    >
                      <Text style={[styles.placeButtonText, { color: accent }]}>
                        Coming soon
                      </Text>
                    </View>
                  )}
                  {isAccessory && acc && !headLocked && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.placeButton,
                        isWorn
                          ? { backgroundColor: accent }
                          : { borderWidth: 1.5, borderColor: accent },
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (isWorn) {
                          unequipSlot(acc.slot);
                        } else {
                          equipAccessory(item.id, selectedMonster);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isWorn ? `Take off ${item.name}` : `Wear ${item.name}`
                      }
                    >
                      <Text
                        style={[
                          styles.placeButtonText,
                          { color: isWorn ? accentText : accent },
                        ]}
                      >
                        {isWorn ? "Wearing \u2713" : "Wear"}
                      </Text>
                    </Pressable>
                  )}
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
                </View>
                {isAccessory && acc && headLocked && (
                  <ThemedText style={styles.lockNote}>
                    Luna&apos;s hat is already part of her look — head items
                    unlock when hatless art arrives.
                  </ThemedText>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyEmoji}>🎁</ThemedText>
          <ThemedText style={styles.emptyTitle}>Collection Empty</ThemedText>
          <ThemedText style={styles.emptyMessage}>
            Visit the Points Store to collect toys, accessories, and decor!
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 20,
  },
  wearingSummary: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  itemsGrid: {
    gap: 12,
    paddingBottom: 40,
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
  slotHint: {
    fontSize: 12,
    opacity: 0.55,
    marginTop: -8,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  placeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  placeButtonText: {
    fontWeight: "700",
    fontSize: 13,
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
  lockNote: {
    fontSize: 12,
    opacity: 0.55,
    marginTop: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyMessage: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
