import { Platform } from "react-native";

/**
 * Gentle daily nudge notifications (local, Expo Go compatible).
 *
 * Scheme: at most ONE notification per day, at NUDGE_HOUR local time, and
 * only on days the monster hasn't been cared for yet. We schedule the next
 * NUDGE_WINDOW_DAYS eligible evenings ahead; every care action and every
 * app launch wipes and reschedules the window. If the app is never
 * reopened, nudges stop after the window — we don't pester lapsed players.
 *
 * The fixed evening hour doubles as a quiet-hours guarantee: nothing ever
 * fires early in the morning or late at night.
 *
 * Expo Go note (SDK 53+): remote push was removed from Expo Go, but local
 * scheduled notifications like these remain fully supported. Remote push,
 * if ever needed, requires a development build.
 */

export const NUDGE_HOUR = 18; // 6pm local
const NUDGE_WINDOW_DAYS = 3;
const NUDGE_ID_PREFIX = "daily-nudge-";
const CHANNEL_ID = "gentle-reminders";

// Zero-shame copy: an invitation, never guilt or urgency.
const NUDGE_MESSAGES: {
  title: (name: string) => string;
  body: (name: string) => string;
}[] = [
  {
    title: (name) => `${name} says hi 👋`,
    body: () => "No pressure — even a two-minute tidy makes their day.",
  },
  {
    title: () => "A little mess, a little magic ✨",
    body: (name) => `${name} would love a tiny task together, whenever suits.`,
  },
  {
    title: (name) => `${name} was just thinking of you 💚`,
    body: () =>
      "One small chore keeps the cozy going. Only if you feel like it!",
  },
];

/**
 * Load only the expo-notifications submodules we need, never the package
 * barrel. Importing "expo-notifications" evaluates getExpoPushTokenAsync →
 * DevicePushTokenAutoRegistration.fx, which calls addPushTokenListener at
 * module scope — remote-push machinery that throws in Expo Go on Android
 * (removed in SDK 53). Local scheduled notifications need no push token,
 * so these side-effect-free deep imports are the entire surface we use.
 */
async function getNotifications() {
  try {
    if (Platform.OS === "web") return null;
    const [
      { setNotificationHandler },
      { setNotificationChannelAsync },
      { AndroidImportance },
      { getPermissionsAsync, requestPermissionsAsync },
      { cancelScheduledNotificationAsync },
      { scheduleNotificationAsync },
      { SchedulableTriggerInputTypes },
    ] = await Promise.all([
      import("expo-notifications/build/NotificationsHandler"),
      import("expo-notifications/build/setNotificationChannelAsync"),
      import("expo-notifications/build/NotificationChannelManager.types"),
      import("expo-notifications/build/NotificationPermissions"),
      import("expo-notifications/build/cancelScheduledNotificationAsync"),
      import("expo-notifications/build/scheduleNotificationAsync"),
      import("expo-notifications/build/Notifications.types"),
    ]);
    return {
      setNotificationHandler,
      setNotificationChannelAsync,
      AndroidImportance,
      getPermissionsAsync,
      requestPermissionsAsync,
      cancelScheduledNotificationAsync,
      scheduleNotificationAsync,
      SchedulableTriggerInputTypes,
    };
  } catch {
    // Unavailable (web, tests) — every caller treats null as a no-op.
    return null;
  }
}

/**
 * Set the foreground handler and Android channel. Called once at app start.
 * Deliberately does NOT request permission — that happens at the first
 * reward claim (see explore.tsx), not on first launch.
 */
export async function initNotifications(): Promise<void> {
  const N = await getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Gentle reminders",
        importance: N.AndroidImportance.DEFAULT,
      });
    }
  } catch (e) {
    if (__DEV__) console.warn("[Nudge] init failed:", e);
  }
}

/** Ask for notification permission (no-op true if already granted). */
export async function requestNudgePermission(): Promise<boolean> {
  const N = await getNotifications();
  if (!N) return false;
  try {
    const existing = await N.getPermissionsAsync();
    if (existing.granted) return true;
    const { granted } = await N.requestPermissionsAsync();
    return granted;
  } catch (e) {
    if (__DEV__) console.warn("[Nudge] permission request failed:", e);
    return false;
  }
}

/**
 * Wipe and re-plan the nudge window. Silently no-ops without permission,
 * so it is safe to fire-and-forget from any care action or app launch.
 *
 * @param monsterName display name for the copy ("" falls back generically)
 * @param caredToday  true skips today's slot and starts tomorrow
 */
export async function rescheduleDailyNudges(
  monsterName: string,
  caredToday: boolean,
): Promise<void> {
  const N = await getNotifications();
  if (!N) return;
  try {
    const perm = await N.getPermissionsAsync();
    if (!perm.granted) return;

    for (let i = 0; i < NUDGE_WINDOW_DAYS; i++) {
      await N.cancelScheduledNotificationAsync(`${NUDGE_ID_PREFIX}${i}`);
    }

    const now = new Date();
    const first = new Date(now);
    first.setHours(NUDGE_HOUR, 0, 0, 0);
    if (caredToday || first <= now) first.setDate(first.getDate() + 1);

    const name = monsterName || "Your monster";
    for (let i = 0; i < NUDGE_WINDOW_DAYS; i++) {
      const fireDate = new Date(first);
      fireDate.setDate(first.getDate() + i);
      const msg = NUDGE_MESSAGES[fireDate.getDate() % NUDGE_MESSAGES.length];
      await N.scheduleNotificationAsync({
        identifier: `${NUDGE_ID_PREFIX}${i}`,
        content: {
          title: msg.title(name),
          body: msg.body(name),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch (e) {
    if (__DEV__) console.warn("[Nudge] scheduling failed:", e);
  }
}
