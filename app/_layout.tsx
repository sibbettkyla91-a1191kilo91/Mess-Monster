import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePetStore } from "@/store/use-pet-store";
import { useTasksStore } from "@/store/use-tasks-store";
import { subscribeUnsettledGrantRecovery } from "@/store/recover-unsettled-grants";
import { subscribeUnsettledPurchaseRecovery } from "@/store/recover-unsettled-purchases";
import { initNotifications } from "@/utils/daily-nudge";

export const unstable_settings = {
  anchor: "onboarding",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Handler + Android channel only — permission is requested later, at
    // the first reward claim, never on first launch.
    void initNotifications();
  }, []);

  // Hours can pass while the app sits in the background: stats fall behind and
  // the calendar day can roll over. A cold start catches up from each store's
  // rehydration, so this is the other way back in — one listener at the app
  // root, replaying the same store actions rather than duplicating them.
  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      const returning =
        (previous === "background" || previous === "inactive") &&
        next === "active";
      previous = next;
      if (!returning) return;
      // Pre-hydration writes get clobbered by the hydration merge, and
      // rehydration runs this same catch-up itself, so there is nothing worth
      // doing until each store is ready.
      if (usePetStore.persist.hasHydrated()) {
        usePetStore.getState().applyDecay();
      }
      if (useTasksStore.persist.hasHydrated()) {
        useTasksStore.getState().refreshDailyRoll();
      }
    });
    return () => sub.remove();
  }, []);

  // Reserved grants live in the tasks store; their points/pet/history writes
  // live in other stores. After a crash between those writes, replay any
  // leftover intent once all three stores have actually rehydrated.
  useEffect(() => subscribeUnsettledGrantRecovery(), []);
  useEffect(() => subscribeUnsettledPurchaseRecovery(), []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
