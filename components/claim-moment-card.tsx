import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

import { useMonsterTheme } from "@/hooks/use-monster-theme";
import { ClaimMoment } from "@/store/claim-moment";

const fontRounded = Platform.select({
  ios: "ui-rounded",
  android: "sans-serif-medium",
  default: "system-ui",
});

type Props = {
  moment: ClaimMoment;
  displayName: string;
  /** Skip the bar fill animation. */
  reduceMotion?: boolean;
  /** Compact: no card chrome, for embedding inside the reward modal. */
  embedded?: boolean;
};

/**
 * The short "that counted" moment after a claim: points in, the level bar
 * ticking up, a level-up or milestone when one happened, and one line from
 * the monster. Reads only from the ClaimMoment it is given — it never
 * touches a store, so an interrupted animation loses nothing.
 */
export function ClaimMomentCard({
  moment,
  displayName,
  reduceMotion = false,
  embedded = false,
}: Props) {
  const { accent, accentSoft, onSoft, surface, ink, inkMuted, line } =
    useMonsterTheme();
  const { progress, pointsGained, leveledUp, milestone, voiceLine } = moment;

  // Fill from where the bar was (or from empty after a level-up) to now.
  const startFraction = leveledUp
    ? 0
    : Math.max(0, progress.fraction - pointsGained / (progress.span || 1));
  const fill = useRef(
    new Animated.Value(reduceMotion ? progress.fraction : startFraction),
  ).current;

  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(progress.fraction);
      return;
    }
    const anim = Animated.timing(fill, {
      toValue: progress.fraction,
      duration: 700,
      delay: 150,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [fill, progress.fraction, reduceMotion]);

  const width = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const levelLine = leveledUp
    ? `Level ${moment.levelBefore} → ${progress.level}`
    : `Level ${progress.level}`;
  const remainingLine = progress.atMax
    ? "Top level"
    : `${progress.remaining} to level ${progress.level + 1}`;

  return (
    <View
      style={[
        styles.card,
        embedded
          ? styles.embedded
          : { backgroundColor: surface, borderColor: line },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${pointsGained} points for ${displayName}. ${levelLine}. ${remainingLine}.`}
      testID="claim-moment"
    >
      <View style={styles.row}>
        <Text style={[styles.points, { color: ink, fontFamily: fontRounded }]}>
          +{pointsGained} pts
        </Text>
        <Text
          style={[
            styles.level,
            { color: leveledUp ? accent : inkMuted, fontFamily: fontRounded },
          ]}
        >
          {levelLine}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: accentSoft }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: accent, width }]}
        />
      </View>
      <Text style={[styles.remaining, { color: inkMuted }]}>
        {remainingLine}
      </Text>
      {milestone && (
        <View style={[styles.milestone, { backgroundColor: accentSoft }]}>
          <Text style={[styles.milestoneTitle, { color: onSoft }]}>
            {milestone.title}
          </Text>
          <Text style={[styles.milestoneNote, { color: onSoft }]}>
            {milestone.note[moment.monster]}
          </Text>
        </View>
      )}
      <Text style={[styles.voice, { color: ink }]}>
        {displayName}: “{voiceLine}”
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  embedded: {
    width: "100%",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  points: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  level: {
    fontSize: 13,
    fontWeight: "700",
  },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  remaining: {
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  milestone: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
    marginTop: 2,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  milestoneNote: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
  voice: {
    fontSize: 13,
    fontWeight: "500",
    fontStyle: "italic",
    lineHeight: 18,
    marginTop: 2,
  },
});
