import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
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

const COMPANION_ART = {
  nilly: require("../../assets/images/nilly_adult.png"),
  luna: require("../../assets/images/luna_adult.png"),
};

const fontRounded = Platform.select({
  ios: "ui-rounded",
  android: "sans-serif-medium",
  default: "system-ui",
});

export default function CollectionScreen() {
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? "nilly";
  const owned = useStoreStore((s) => s.byMonster[selectedMonster].owned);
  const placed = useStoreStore((s) => s.byMonster[selectedMonster].placed);
  const equipped = useStoreStore((s) => s.byMonster[selectedMonster].equipped);
  const togglePlaced = useStoreStore((s) => s.togglePlaced);
  const equipAccessory = useStoreStore((s) => s.equipAccessory);
  const unequipSlot = useStoreStore((s) => s.unequipSlot);
  const monsterName = usePlayerStore((s) => s.monsterName);
  const storeHydrated = useHasHydrated(useStoreStore);
  const playerHydrated = useHasHydrated(usePlayerStore);
  const hydrated = storeHydrated && playerHydrated;
  const insets = useSafeAreaInsets();

  const ownedItems = useMemo(
    () => Object.values(owned).filter((e) => e.quantity > 0),
    [owned],
  );
  const {
    accent,
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
  const containerStyle = [
    styles.container,
    { backgroundColor: page, paddingTop: insets.top + 14 },
  ];

  const displayName =
    monsterName || (selectedMonster === "luna" ? "Luna" : "Nilly");
  const worldLine =
    monster === "luna"
      ? "Night things. Kept for her."
      : "Sunlit things. Kept for her.";

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
      <View style={containerStyle}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: ink, fontFamily: fontRounded }]}>
            Collection
          </Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={accent} />
          <Text style={[styles.loadingText, { color: inkMuted }]}>
            Opening collection…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: ink, fontFamily: fontRounded }]}>
          Collection
        </Text>
        {wearingBySlot.length > 0 && (
          <Text style={[styles.wearingSummary, { color: inkMuted }]}>
            Wearing:{" "}
            {wearingBySlot
              .map((row) => `${SLOT_LABEL[row.slot]} · ${row.name}`)
              .join("  ")}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.companionCard,
          { backgroundColor: surfaceRaised, borderColor: line },
        ]}
      >
        <Image
          source={COMPANION_ART[selectedMonster === "luna" ? "luna" : "nilly"]}
          style={styles.companionArt}
          resizeMode="contain"
        />
        <View style={styles.companionCopy}>
          <Text
            style={[
              styles.companionName,
              { color: ink, fontFamily: fontRounded },
            ]}
          >
            {displayName}
          </Text>
          <Text style={[styles.companionWorld, { color: inkMuted }]}>
            {worldLine}
          </Text>
        </View>
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
            const raised = isWorn || isPlaced;

            return (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: raised ? surfaceRaised : surface,
                    borderColor: raised ? accent : line,
                  },
                ]}
              >
                <View
                  style={[styles.emojiWell, { backgroundColor: accentSoft }]}
                >
                  <Text style={styles.itemEmoji}>{item.emoji}</Text>
                </View>
                <Text
                  style={[
                    styles.itemName,
                    { color: ink, fontFamily: fontRounded },
                  ]}
                >
                  {item.name}
                </Text>
                <Text style={[styles.itemDesc, { color: inkMuted }]}>
                  {item.description}
                </Text>
                {isAccessory && acc && (
                  <Text style={[styles.slotHint, { color: inkMuted }]}>
                    {SLOT_LABEL[acc.slot]} slot
                    {isWorn ? " · on your monster" : ""}
                  </Text>
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
                          { color: isPlaced ? onSoft : accent },
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
                          { color: isWorn ? onSoft : accent },
                        ]}
                      >
                        {isWorn ? "Wearing \u2713" : "Wear"}
                      </Text>
                    </Pressable>
                  )}
                  <View
                    style={[styles.ownedBadge, { backgroundColor: accentSoft }]}
                  >
                    <Text style={[styles.ownedText, { color: onSoft }]}>
                      {"\u2713"} Owned
                    </Text>
                  </View>
                </View>
                {isAccessory && acc && headLocked && (
                  <Text style={[styles.lockNote, { color: inkMuted }]}>
                    Luna&apos;s hat is already part of her look — head items
                    unlock when hatless art arrives.
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: ink }]}>
            Nothing here yet
          </Text>
          <Text style={[styles.emptyMessage, { color: inkMuted }]}>
            The shop has toys, wearables, and a few things for the room. Buy
            something once — it lives here.
          </Text>
        </View>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  wearingSummary: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
  },
  companionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  companionArt: {
    width: 72,
    height: 104,
  },
  companionCopy: {
    flex: 1,
    gap: 4,
  },
  companionName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  companionWorld: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  itemsGrid: {
    gap: 12,
    paddingBottom: 40,
  },
  itemCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  emojiWell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  itemEmoji: {
    fontSize: 28,
  },
  itemName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
  },
  slotHint: {
    fontSize: 12,
    fontWeight: "500",
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
    fontWeight: "500",
    marginTop: 10,
    lineHeight: 17,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
