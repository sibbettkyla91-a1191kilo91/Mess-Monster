import { useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";

import { useMonsterTheme } from "@/hooks/use-monster-theme";

interface TaskTimerProps {
  /** Total seconds for the countdown */
  totalSeconds: number;
  /** Unix ms when the wait started — remaining time is wall-clock based */
  startedAt: number;
  /** Called when the timer reaches zero */
  onComplete: () => void;
  /** Whether the timer is actively running */
  active: boolean;
}

function remainingSeconds(startedAt: number, totalSeconds: number): number {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, totalSeconds - elapsed);
}

const fontRounded = Platform.select({
  ios: "ui-rounded",
  android: "sans-serif-medium",
  default: "system-ui",
});

export function TaskTimer({
  totalSeconds,
  startedAt,
  onComplete,
  active,
}: TaskTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(startedAt, totalSeconds),
  );
  // Keep a stable ref to onComplete so the timer never restarts just because
  // the parent passed a new inline arrow function.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);
  const { accent, ink, inkMuted, line } = useMonsterTheme();

  useEffect(() => {
    if (!active) return;

    firedRef.current = false;

    // Wall-clock based: recompute from startedAt on every tick, so time spent
    // backgrounded (where JS timers are suspended) still counts toward the wait.
    const tick = () => setRemaining(remainingSeconds(startedAt, totalSeconds));
    tick();
    const interval = setInterval(tick, 1000);
    // Recompute the moment the app returns to the foreground instead of
    // waiting up to a second for the next interval tick.
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") tick();
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [active, totalSeconds, startedAt]); // onComplete intentionally omitted — we use onCompleteRef

  // Call onComplete outside the state updater (pure updaters only) and guard
  // against React Strict Mode's double-invocation of effects.
  useEffect(() => {
    if (remaining === 0 && active && !firedRef.current) {
      firedRef.current = true;
      onCompleteRef.current();
    }
  }, [remaining, active]);

  if (!active && remaining === totalSeconds) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = 1 - remaining / totalSeconds;

  return (
    <View style={styles.container}>
      <View style={[styles.barBackground, { backgroundColor: line }]}>
        <View
          style={[
            styles.barFill,
            { width: `${progress * 100}%`, backgroundColor: accent },
          ]}
        />
      </View>
      {remaining > 0 ? (
        <Text style={styles.timeRow}>
          <Text
            style={[
              styles.timeNumeral,
              { color: ink, fontFamily: fontRounded },
            ]}
          >
            {minutes}:{seconds.toString().padStart(2, "0")}
          </Text>
          <Text style={[styles.timeHint, { color: inkMuted }]}> remaining</Text>
        </Text>
      ) : (
        <Text style={[styles.timeHint, { color: inkMuted }]}>
          Timer complete!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    paddingVertical: 8,
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  timeRow: {
    textAlign: "center",
  },
  timeNumeral: {
    fontSize: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  timeHint: {
    fontSize: 12,
    fontWeight: "500",
    fontStyle: "italic",
    textAlign: "center",
  },
});
