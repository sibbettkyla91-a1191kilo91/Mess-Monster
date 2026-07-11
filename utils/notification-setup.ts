import Constants from "expo-constants";

/**
 * Set up notification handlers and request permission.
 * This should be called once on app launch.
 *
 * NOTE: expo-notifications import is done conditionally to avoid triggering
 * auto push-token registration in Expo Go (SDK 53+ removed this functionality).
 * The import is deferred until this function runs, preventing the side effect
 * from DevicePushTokenAutoRegistration.fx.js when running in Expo Go.
 */
export async function setupNotifications() {
  // Skip entirely in Expo Go — import would trigger auto-registration crash
  if (Constants.appOwnership === "expo") {
    console.log(
      "[Notifications] Running in Expo Go; skipping notification setup (push notifications not supported in SDK 53+)",
    );
    return;
  }

  try {
    // Only import expo-notifications outside of Expo Go to prevent auto-registration side effect
    const Notifications = await import("expo-notifications");

    // Set notification handler — defines how notifications appear when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Request permission to send notifications (push)
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "Notification permission denied. Users will not receive decay reminders.",
      );
      return;
    }

    // Optional: set up Android channel for better appearance
    if (
      Notifications.getNotificationChannelsAsync &&
      typeof Notifications.getNotificationChannelsAsync === "function"
    ) {
      try {
        const channels =
          await Notifications.getNotificationChannelsAsync?.();
        if (!channels?.some((c) => c.id === "decay-reminders")) {
          await Notifications.setNotificationChannelAsync?.(
            "decay-reminders",
            {
              name: "Decay Reminders",
              importance: Notifications.AndroidImportance.HIGH,
              sound: "default",
            },
          );
        }
      } catch (e) {
        if (__DEV__) console.warn("Android channel error:", e);
      }
    }
  } catch (e) {
    if (__DEV__) console.warn("Failed to set up notifications:", e);
    // Silently fail — notifications are nice-to-have, not critical
  }
}
