import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * Soft hold while a persisted store finishes loading. Used instead of a
 * blank screen so a cold start never looks like a crash.
 */
export function BootScreen({
  tone = "mint",
}: {
  tone?: "mint" | "night";
}) {
  const night = tone === "night";
  return (
    <View
      style={[styles.screen, { backgroundColor: night ? "#0c0a12" : "#e8f0e6" }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Opening Mess Monster"
    >
      <Text style={[styles.wordmark, { color: night ? "#f4efe6" : "#1e3a2f" }]}>
        Mess Monster
      </Text>
      <Text style={[styles.hint, { color: night ? "#f4efe6" : "#5a6b60" }]}>
        Opening the house…
      </Text>
      <ActivityIndicator color={night ? "#e8b86d" : "#52b788"} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 28,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: "800",
  },
  hint: {
    fontSize: 15,
    marginBottom: 8,
    opacity: 0.7,
  },
});
