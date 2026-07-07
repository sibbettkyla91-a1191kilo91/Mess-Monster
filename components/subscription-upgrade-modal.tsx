import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
} from "react-native";
import { ThemedText } from "./themed-text";

export interface UpgradeModalProps {
  visible: boolean;
  onDismiss: () => void;
  onStartTrial: () => void;
  onSubscribe: (tier: "monthly" | "yearly") => void;
  isLoading?: boolean;
}

const PREMIUM_BENEFITS = [
  { emoji: "🧬", text: "Evolve to Adult stage" },
  { emoji: "🚫", text: "No ads" },
  { emoji: "⚡", text: "Shorter task timers" },
  { emoji: "🎵", text: "Spotify music integration" },
];

export function SubscriptionUpgradeModal({
  visible,
  onDismiss,
  onStartTrial,
  onSubscribe,
  isLoading = false,
}: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<"monthly" | "yearly">(
    "monthly",
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>✨</Text>
              <ThemedText style={styles.title}>Unlock Premium</ThemedText>
              <ThemedText style={styles.subtitle}>
                Evolve your monster & remove ads
              </ThemedText>
            </View>

            {/* Benefits List */}
            <View style={styles.benefitsContainer}>
              {PREMIUM_BENEFITS.map((benefit, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Text style={styles.benefitEmoji}>{benefit.emoji}</Text>
                  <ThemedText style={styles.benefitText}>
                    {benefit.text}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* Free Trial CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.trialButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={onStartTrial}
              disabled={isLoading}
            >
              <ThemedText style={styles.trialButtonText}>
                🎁 Start 3-Day Free Trial
              </ThemedText>
            </Pressable>

            <ThemedText style={styles.orText}>or subscribe below</ThemedText>

            {/* Subscription Tier Selection */}
            <View style={styles.tierContainer}>
              {/* Monthly */}
              <Pressable
                style={({ pressed }) => [
                  styles.tierCard,
                  selectedTier === "monthly" && styles.tierCardSelected,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => setSelectedTier("monthly")}
              >
                <ThemedText style={styles.tierName}>Monthly</ThemedText>
                <ThemedText style={styles.tierPrice}>$4.99</ThemedText>
                <ThemedText style={styles.tierPeriod}>/month</ThemedText>
                {selectedTier === "monthly" && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>

              {/* Yearly (with discount badge) */}
              <Pressable
                style={({ pressed }) => [
                  styles.tierCard,
                  selectedTier === "yearly" && styles.tierCardSelected,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => setSelectedTier("yearly")}
              >
                <View style={styles.badgeContainer}>
                  <Text style={styles.saveBadge}>SAVE 58%</Text>
                </View>
                <ThemedText style={styles.tierName}>Yearly</ThemedText>
                <ThemedText style={styles.tierPrice}>$19.99</ThemedText>
                <ThemedText style={styles.tierPeriod}>/year</ThemedText>
                {selectedTier === "yearly" && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>
            </View>

            {/* Subscribe Button */}
            <Pressable
              style={({ pressed }) => [
                styles.subscribeButton,
                { opacity: pressed || isLoading ? 0.7 : 1 },
              ]}
              onPress={() => onSubscribe(selectedTier)}
              disabled={isLoading}
            >
              <ThemedText style={styles.subscribeButtonText}>
                {isLoading
                  ? "Processing..."
                  : `Subscribe - ${selectedTier === "monthly" ? "$4.99" : "$19.99"}`}
              </ThemedText>
            </Pressable>

            {/* Dismiss Button */}
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              onPress={onDismiss}
              disabled={isLoading}
            >
              <ThemedText style={styles.dismissText}>Maybe later</ThemedText>
            </Pressable>

            {/* Legal */}
            <ThemedText style={styles.legal}>
              Subscription renews automatically. Cancel anytime in settings.
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  container: {
    backgroundColor: "#1a1a2e",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 8,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },
  benefitsContainer: {
    gap: 12,
    marginVertical: 8,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  benefitEmoji: {
    fontSize: 20,
  },
  benefitText: {
    fontSize: 15,
    fontWeight: "500",
  },
  trialButton: {
    backgroundColor: "#52b788",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginVertical: 8,
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  orText: {
    textAlign: "center",
    fontSize: 12,
    opacity: 0.5,
    marginVertical: 4,
  },
  tierContainer: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8,
  },
  tierCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#444",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tierCardSelected: {
    borderColor: "#52b788",
    backgroundColor: "rgba(82, 183, 136, 0.1)",
  },
  tierName: {
    fontSize: 14,
    fontWeight: "600",
  },
  tierPrice: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  tierPeriod: {
    fontSize: 11,
    opacity: 0.6,
  },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    fontSize: 20,
    color: "#52b788",
  },
  badgeContainer: {
    position: "absolute",
    top: -8,
    left: "50%",
    transform: [{ translateX: -25 }],
  },
  saveBadge: {
    backgroundColor: "#cc2222",
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  subscribeButton: {
    backgroundColor: "#52b788",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  dismissText: {
    textAlign: "center",
    fontSize: 14,
    opacity: 0.5,
    paddingVertical: 12,
  },
  legal: {
    textAlign: "center",
    fontSize: 11,
    opacity: 0.4,
    marginTop: 8,
  },
});
