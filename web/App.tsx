/**
 * Standalone web app component used by the webpack build.
 * Keeps things simple — no expo-router, no native-only APIs.
 */
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function WebApp() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.emoji}>🧟</Text>
          <Text style={styles.title}>Mess Monster</Text>
          <Text style={styles.tagline}>Your gamified cleaning companion</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it works</Text>
          <Text style={styles.cardBody}>
            Log real-world cleaning tasks, earn points, and spend them to care
            for your virtual mess monster. Keep cleaning to help it thrive —
            neglect it and watch the drama unfold. 🫧
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get the app</Text>
          <Text style={styles.cardBody}>
            Mess Monster is a mobile-first experience. Download it on Android to
            meet Nilly, your mint-green kawaii companion (or Luna, the dark
            witchy alternative).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E6F4FE",
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    padding: 24,
    gap: 20,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emoji: {
    fontSize: 72,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    color: "#2C7EDB",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: "#4A5568",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 480,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A202C",
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "#4A5568",
  },
});
