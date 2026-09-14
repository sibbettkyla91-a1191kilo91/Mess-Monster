import { Pressable, StyleSheet, Text, View } from "react-native";

export type InteractChoice = {
  id: string;
  name: string;
  emoji: string;
  quantity?: number;
};

type Props = {
  displayName: string;
  accent: string;
  accentInk: string;
  cardBg: string;
  text: string;
  muted: string;
  border: string;
  foods: InteractChoice[];
  toys: InteractChoice[];
  picker: "feed" | "play" | null;
  reactionLine: string | null;
  onPet: () => void;
  onAskFeed: () => void;
  onAskPlay: () => void;
  onChooseItem: (id: string) => void;
  onGoToShop: () => void;
  onClose: () => void;
};

export function PetInteractMenu({
  displayName,
  accent,
  accentInk,
  cardBg,
  text,
  muted,
  border,
  foods,
  toys,
  picker,
  reactionLine,
  onPet,
  onAskFeed,
  onAskPlay,
  onChooseItem,
  onGoToShop,
  onClose,
}: Props) {
  const picking = picker !== null;
  const choices = picker === "feed" ? foods : picker === "play" ? toys : [];
  const empty = picking && choices.length === 0;
  const emptyCopy =
    picker === "feed"
      ? `No snacks in ${displayName}'s bag yet. The shop has treats when you're ready.`
      : `No toys in ${displayName}'s bag yet. The shop has something to play with when you're ready.`;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
      >
        {reactionLine ? (
          <Text style={[styles.reaction, { color: text }]}>{reactionLine}</Text>
        ) : null}

        {!picking ? (
          <View style={styles.row}>
            <Pressable
              onPress={onAskFeed}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: accent, opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Feed ${displayName}`}
            >
              <Text style={[styles.actionText, { color: accentInk }]}>
                Feed
              </Text>
            </Pressable>
            <Pressable
              onPress={onAskPlay}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: accent, opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Play with ${displayName}`}
            >
              <Text style={[styles.actionText, { color: accentInk }]}>
                Play
              </Text>
            </Pressable>
            <Pressable
              onPress={onPet}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: accent, opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Pet ${displayName}`}
            >
              <Text style={[styles.actionText, { color: accentInk }]}>Pet</Text>
            </Pressable>
          </View>
        ) : empty ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyText, { color: text }]}>{emptyCopy}</Text>
            <Pressable
              onPress={onGoToShop}
              style={({ pressed }) => [
                styles.shopButton,
                { backgroundColor: accent, opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Visit the points store"
            >
              <Text style={[styles.actionText, { color: accentInk }]}>
                Visit shop
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.picker}>
            <Text style={[styles.pickerTitle, { color: muted }]}>
              {picker === "feed" ? "Pick a snack" : "Pick a toy"}
            </Text>
            {choices.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onChooseItem(item.id)}
                style={({ pressed }) => [
                  styles.choice,
                  { borderColor: border, opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  picker === "feed"
                    ? `Feed ${item.name}`
                    : `Play with ${item.name}`
                }
              >
                <Text style={styles.choiceEmoji}>{item.emoji}</Text>
                <Text style={[styles.choiceName, { color: text }]}>
                  {item.name}
                </Text>
                {picker === "feed" && item.quantity != null ? (
                  <Text style={[styles.choiceQty, { color: muted }]}>
                    ×{item.quantity}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={onClose}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close care menu"
        >
          <Text style={[styles.closeText, { color: muted }]}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    width: "100%",
  },
  card: {
    minWidth: 260,
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  reaction: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyBlock: {
    gap: 10,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  shopButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  picker: {
    gap: 8,
  },
  pickerTitle: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceEmoji: {
    fontSize: 22,
  },
  choiceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  choiceQty: {
    fontSize: 13,
    fontWeight: "600",
  },
  close: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  closeText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
