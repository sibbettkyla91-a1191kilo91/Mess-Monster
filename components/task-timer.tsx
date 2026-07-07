import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useMonsterTheme } from "@/hooks/use-monster-theme";

interface TaskTimerProps {
  /** Total seconds for the countdown */
  totalSeconds: number;
  /** Called when the timer reaches zero */
  onComplete: () => void;
  /** Whether the timer is actively running */
  active: boolean;
}

export function TaskTimer({
  totalSeconds,
  onComplete,
  active,
}: TaskTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a stable ref to onComplete so the timer never restarts just because
  // the parent passed a new inline arrow function.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);
  const { accent } = useMonsterTheme();

  useEffect(() => {
    if (!active) return;

    firedRef.current = false;
    setRemaining(totalSeconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, totalSeconds]); // onComplete intentionally omitted — we use onCompleteRef

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
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            { width: `${progress * 100}%`, backgroundColor: accent },
          ]}
        />
      </View>
      <Text style={[styles.timeText, { color: accent }]}>
        {remaining > 0
          ? `${minutes}:${seconds.toString().padStart(2, "0")} remaining`
          : "Timer complete!"}
      </Text>
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
    backgroundColor: "#e0e0e0",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
