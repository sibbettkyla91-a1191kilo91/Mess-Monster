import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Mirrors the OS "reduce motion" setting. Starts false and flips once the
 * async read lands; follows live changes. Same pattern as the store and
 * explore screens use inline.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
