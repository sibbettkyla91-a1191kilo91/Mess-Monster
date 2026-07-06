import * as Notifications from "expo-notifications";

/**
 * Set up notification handlers and request permission.
 * This should be called once on app launch.
 */
export async function setupNotifications() {
  try {
    // Set notification handler — defines how notifications appear when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Request permission to send notifications
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
        const channels = await Notifications.getNotificationChannelsAsync?.();
        if (!channels?.some((c) => c.id === "decay-reminders")) {
          await Notifications.setNotificationChannelAsync?.("decay-reminders", {
            name: "Decay Reminders",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
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
