import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useMonsterTheme } from "@/hooks/use-monster-theme";
import { useStoreStore } from "@/store/use-store-store";

export default function CollectionScreen() {
  const ownedItems = useStoreStore((s) => s.getOwnedItems());
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const {
    accent,
    accentLight,
    accentDark,
    text: accentText,
  } = useMonsterTheme();

  // Filter to only non-repeatable items (accessories and decor that user keeps)
  const collectionItems = ownedItems.filter((entry) => !entry.item.repeatable);

  const hasItems = collectionItems.length > 0;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title">My Collection</ThemedText>
      </View>

      {hasItems ? (
        <ScrollView
          contentContainerStyle={styles.itemsGrid}
          showsVerticalScrollIndicator={false}
        >
          {collectionItems.map((entry) => {
            const { item } = entry;
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

                <View style={styles.itemFooter}>
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
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyEmoji}>🎁</ThemedText>
          <ThemedText style={styles.emptyTitle}>Collection Empty</ThemedText>
          <ThemedText style={styles.emptyMessage}>
            Visit the Points Store to collect accessories and decor!
          </ThemedText>
        </View>
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
    marginBottom: 20,
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
  itemFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
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
