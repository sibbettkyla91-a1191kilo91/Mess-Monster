/**
 * Standalone web app component used by the webpack build.
 * Keeps things simple — no expo-router, no native-only APIs.
 */
import React from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function WebApp() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.pair}>
            <Image
              source={require("../assets/images/luna_adult.png")}
              style={styles.mascot}
              resizeMode="contain"
            />
            <Image
              source={require("../assets/images/nilly_adult.png")}
              style={styles.mascot}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Mess Monster</Text>
          <Text style={styles.tagline}>
            Take care of your space. Your monster grows with you.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it works</Text>
          <Text style={styles.cardBody}>
            Log the cleaning you already did. Points go to food, toys, and a
            few things for the room. Miss a day? Nothing breaks. Pick it up
            when you can.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Two companions</Text>
          <Text style={styles.cardBody}>
            Nilly is warm and sunlit. Luna is night-sided and a little witchy.
            Same house, different worlds. The app is on Android.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#100e16",
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    padding: 24,
    gap: 20,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  pair: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  mascot: {
    width: 120,
    height: 180,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    color: "#f0e6d3",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 17,
    color: "rgba(240,230,211,0.7)",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 360,
  },
  card: {
    backgroundColor: "#1a1622",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 480,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(240,230,211,0.1)",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f0e6d3",
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(240,230,211,0.68)",
  },
});
