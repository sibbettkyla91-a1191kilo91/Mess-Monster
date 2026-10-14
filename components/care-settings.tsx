import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_SUMMARY,
} from "@/constants/legal";
import { localDayString } from "@/utils/local-day";
import {
  requestNudgePermission,
  rescheduleDailyNudges,
} from "@/utils/daily-nudge";

type ThemeBits = {
  accent: string;
  cardBg: string;
  text: string;
  muted: string;
  border: string;
};

export function CareSettings({
  theme,
  monsterName,
  lastCaredAt,
  notifAsked,
  onMarkNotifAsked,
  onClose,
}: {
  theme: ThemeBits;
  monsterName: string;
  lastCaredAt: number;
  notifAsked: boolean;
  onMarkNotifAsked: () => void;
  onClose: () => void;
}) {
  const [pane, setPane] = useState<"menu" | "privacy">("menu");
  const [nudgeNote, setNudgeNote] = useState<string | null>(null);
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const allowReminders = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const granted = await requestNudgePermission();
    onMarkNotifAsked();
    if (granted) {
      const caredToday =
        localDayString(new Date(lastCaredAt)) === localDayString();
      void rescheduleDailyNudges(monsterName, caredToday);
      setNudgeNote("Evening reminders are on. One quiet check-in a day.");
    } else {
      setNudgeNote("That’s okay. You can turn them on later in phone settings.");
    }
  };

  return (
    <Pressable
      style={styles.overlay}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Close settings"
    >
      <Pressable
        style={[
          styles.sheet,
          { backgroundColor: theme.cardBg, borderColor: theme.border },
        ]}
        onPress={() => undefined}
        accessibilityRole="summary"
        accessibilityLabel="Care settings"
      >
        {pane === "menu" ? (
          <>
            <Text style={[styles.title, { color: theme.text }]}>Care</Text>
            <Text style={[styles.lede, { color: theme.muted }]}>
              Small house rules. Nothing here is required.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
              ]}
              onPress={() => void allowReminders()}
              accessibilityRole="button"
              accessibilityLabel={
                notifAsked
                  ? "Evening reminders, tap to allow again"
                  : "Allow evening reminders"
              }
            >
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                Evening reminders
              </Text>
              <Text style={[styles.rowHint, { color: theme.muted }]}>
                {notifAsked
                  ? "We already asked once. Tap to try again."
                  : "One gentle hello around 6pm, only if you want it."}
              </Text>
            </Pressable>
            {nudgeNote ? (
              <Text style={[styles.note, { color: theme.accent }]}>
                {nudgeNote}
              </Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPane("privacy");
              }}
              accessibilityRole="button"
              accessibilityLabel="Read the privacy note"
            >
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                Privacy
              </Text>
              <Text style={[styles.rowHint, { color: theme.muted }]}>
                Your house stays on this phone.
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void Linking.openURL(`mailto:${PRIVACY_CONTACT_EMAIL}`);
              }}
              accessibilityRole="link"
              accessibilityLabel="Email the studio"
            >
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                Talk to us
              </Text>
              <Text style={[styles.rowHint, { color: theme.muted }]}>
                {PRIVACY_CONTACT_EMAIL}
              </Text>
            </Pressable>

            <Text style={[styles.meta, { color: theme.muted }]}>
              Mess Monster {version} · free · zero shame
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={[styles.closeText, { color: theme.accent }]}>
                Done
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>Privacy</Text>
            <ScrollView
              style={styles.privacyScroll}
              accessibilityLabel="Privacy note"
            >
              <Text style={[styles.privacyBody, { color: theme.text }]}>
                {PRIVACY_SUMMARY}
              </Text>
            </ScrollView>
            <Pressable
              onPress={() => setPane("menu")}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Back to care settings"
            >
              <Text style={[styles.closeText, { color: theme.accent }]}>
                Back
              </Text>
            </Pressable>
          </>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,10,18,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  row: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  close: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: "700",
  },
  privacyScroll: {
    maxHeight: 280,
  },
  privacyBody: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.88,
  },
});
