import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

/**
 * A short, bounded puff of glyphs for a care moment. Six to eight
 * Animated.Text characters radiate from one point and fade within
 * BURST_DURATION_MS, then the parent unmounts the burst. Presentation only:
 * no store reads, no writes, transforms and opacity on the native driver.
 */

export type BurstKind = "feed" | "play" | "pet" | "welcome";

export const BURST_DURATION_MS = 1100;
/** Home never keeps more than this many bursts mounted at once. */
export const MAX_CONCURRENT_BURSTS = 3;

type Glyph = {
  char: string;
  color: string;
  size: number;
  /** Direction of travel in degrees; 0 = right, -90 = straight up. */
  angle: number;
  distance: number;
  delay: number;
};

const NILLY = {
  mint: "#3aab6f",
  paleMint: "#8fdcb4",
  blush: "#ff9fc0",
};

const LUNA = {
  smoke: "#9a9ab0",
  violet: "#b48cff",
  ember: "#ff7a45",
};

/** Evenly spread directions with a little lean, so no two bursts are twins. */
function spread(count: number, from: number, to: number, jitter: number) {
  const step = (to - from) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i) => {
    const lean = ((i * 7919) % 13) / 13 - 0.5;
    return from + step * i + lean * jitter;
  });
}

function makeGlyphs(monster: "nilly" | "luna", kind: BurstKind): Glyph[] {
  if (monster === "nilly") {
    switch (kind) {
      case "feed": {
        const chars = ["·", "✦", "•", "✧", "·", "✦", "•"];
        return spread(7, -160, -20, 14).map((angle, i) => ({
          char: chars[i],
          color: i % 2 === 0 ? NILLY.mint : NILLY.paleMint,
          size: i % 2 === 0 ? 14 : 18,
          angle,
          distance: 44 + (i % 3) * 10,
          delay: (i % 3) * 40,
        }));
      }
      case "play": {
        const chars = ["★", "✦", "✧", "★", "✦", "✧", "★", "✦"];
        return spread(8, -200, 20, 18).map((angle, i) => ({
          char: chars[i],
          color: i % 3 === 0 ? NILLY.blush : NILLY.mint,
          size: 16 + (i % 3) * 3,
          angle,
          distance: 56 + (i % 2) * 14,
          delay: (i % 4) * 30,
        }));
      }
      case "pet":
      case "welcome": {
        const chars = ["♡", "♡", "✦", "♡", "○", "♡", "✧", "♡"];
        return spread(8, -170, -10, 16).map((angle, i) => ({
          char: chars[i],
          color: chars[i] === "♡" ? NILLY.blush : NILLY.paleMint,
          size: chars[i] === "♡" ? 20 : 14,
          angle,
          distance: 50 + (i % 3) * 8,
          delay: (i % 4) * 50,
        }));
      }
    }
  }
  switch (kind) {
    case "feed": {
      // Smoke: soft grey puffs drifting upward, plus one ember.
      const chars = ["●", "●", "●", "●", "●", "●", "•"];
      return spread(7, -125, -55, 10).map((angle, i) => ({
        char: chars[i],
        color: i === 6 ? LUNA.ember : LUNA.smoke,
        size: i === 6 ? 10 : 12 + (i % 3) * 4,
        angle,
        distance: 58 + (i % 3) * 12,
        delay: i * 55,
      }));
    }
    case "play": {
      const chars = ["★", "✧", "★", "✧", "★", "✧", "•"];
      return spread(7, -200, 20, 18).map((angle, i) => ({
        char: chars[i],
        color: i === 6 ? LUNA.ember : LUNA.violet,
        size: i === 6 ? 9 : 15 + (i % 2) * 4,
        angle,
        distance: 54 + (i % 2) * 14,
        delay: (i % 3) * 35,
      }));
    }
    case "pet":
    case "welcome": {
      // Slow violet sparks, one smoke curl, one ember.
      const chars = ["✧", "✧", "✧", "●", "✧", "✧", "•"];
      return spread(7, -165, -15, 12).map((angle, i) => ({
        char: chars[i],
        color: i === 6 ? LUNA.ember : i === 3 ? LUNA.smoke : LUNA.violet,
        size: i === 3 ? 12 : i === 6 ? 9 : 16 + (i % 2) * 3,
        angle,
        distance: 46 + (i % 3) * 10,
        delay: (i % 4) * 70,
      }));
    }
  }
}

function BurstGlyph({
  glyph,
  slow,
  reduceMotion,
}: {
  glyph: Glyph;
  slow: boolean;
  reduceMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reduce motion: a quick fade in place, no travel.
    const travel = reduceMotion ? 260 : BURST_DURATION_MS - glyph.delay - 60;
    const anim = Animated.sequence([
      Animated.delay(reduceMotion ? 0 : glyph.delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(120, travel),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [progress, glyph.delay, reduceMotion]);

  const rad = (glyph.angle * Math.PI) / 180;
  const dist = reduceMotion ? 0 : glyph.distance;
  const dx = Math.cos(rad) * dist;
  const dy = Math.sin(rad) * dist;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dx],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    // Smoke keeps rising; everything else arcs up then settles a touch.
    outputRange: [0, slow ? dy * 1.15 : dy],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0, 1, 0.8, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.4, 1, slow ? 1.5 : 0.8],
  });

  return (
    <Animated.Text
      style={{
        position: "absolute",
        fontSize: glyph.size,
        color: glyph.color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      {glyph.char}
    </Animated.Text>
  );
}

type Props = {
  monster: "nilly" | "luna";
  kind: BurstKind;
  reduceMotion?: boolean;
};

/**
 * Mount at the point the burst should radiate from (centre the parent on
 * it). The parent owns the lifetime: unmount after BURST_DURATION_MS.
 */
export function BurstParticles({ monster, kind, reduceMotion = false }: Props) {
  const glyphs = makeGlyphs(monster, kind);
  const slow = monster === "luna" && kind === "feed";
  return (
    <View
      pointerEvents="none"
      style={styles.origin}
      testID={`burst-${kind}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {glyphs.map((glyph, i) => (
        <BurstGlyph
          key={`${glyph.char}-${i}`}
          glyph={glyph}
          slow={slow}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: {
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
