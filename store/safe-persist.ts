/**
 * Hydration that cannot wedge.
 *
 * zustand's persist middleware runs getItem → parse → migrate → merge →
 * onRehydrateStorage as one promise chain and only flips hasHydrated() at
 * the end. Any throw along the way lands in a catch that leaves the store
 * unhydrated forever. Every screen gates writes (and, on Home and the tabs,
 * rendering) on hydration, so one unreadable AsyncStorage value or one
 * migration edge case would turn into an app that opens to nothing on every
 * launch. Everything here converts those failures into "start fresh, report
 * it" so the player is never locked out of their own app.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PersistStorage, StorageValue } from "zustand/middleware";

import { reportError } from "@/utils/crash-reporting";

const SOURCE = "persist";

function report(
  error: unknown,
  context: { name: string; phase: string; version?: number },
): void {
  if (__DEV__) {
    console.warn(
      `[persist] ${context.name}: ${context.phase} failed, starting fresh —`,
      error,
    );
  }
  reportError(error, context, SOURCE);
}

/** Where an unreadable save is parked so it can still be inspected. */
export function corruptBackupKey(name: string): string {
  return `${name}:corrupt`;
}

/**
 * JSON storage over AsyncStorage that never rejects. An unreadable value is
 * backed up under `<name>:corrupt`, reported, and treated as a fresh save;
 * a failed write is reported rather than surfacing as an unhandled rejection.
 */
export function createSafeStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(name);
      } catch (error) {
        report(error, { name, phase: "read" });
        return null;
      }
      if (raw == null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !("state" in parsed)) {
          throw new Error("persisted value is not a { state, version } record");
        }
        return parsed as StorageValue<S>;
      } catch (error) {
        report(error, { name, phase: "parse" });
        AsyncStorage.setItem(corruptBackupKey(name), raw).catch(() => {});
        return null;
      }
    },
    setItem: async (name, value) => {
      try {
        await AsyncStorage.setItem(name, JSON.stringify(value));
      } catch (error) {
        report(error, { name, phase: "write" });
      }
    },
    removeItem: async (name) => {
      try {
        await AsyncStorage.removeItem(name);
      } catch (error) {
        report(error, { name, phase: "remove" });
      }
    },
  };
}

/**
 * A migrate that cannot reject hydration. If the real migration throws, the
 * raw persisted state is handed on unchanged and the store's `merge`
 * sanitizer is trusted to give it a usable shape.
 */
export function safeMigrate(
  name: string,
  migrate: (persistedState: any, version: number) => any,
): (persistedState: any, version: number) => any {
  return (persistedState, version) => {
    try {
      return migrate(persistedState, version);
    } catch (error) {
      report(error, { name, phase: "migrate", version });
      return persistedState;
    }
  };
}

/**
 * Run one post-hydration step. A throw is reported and swallowed so the
 * chain still reaches hasHydrated(); a deferred step likewise cannot become
 * an uncaught exception on the next tick.
 */
export function guardHydrationStep(name: string, step: () => void): void {
  try {
    step();
  } catch (error) {
    report(error, { name, phase: "afterHydrate" });
  }
}

// ─── Shape helpers for merge sanitizers ─────────────────────────────────────

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function recordOr(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function arrayOr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** A whole number at or above zero; anything else becomes the fallback. */
export function countOr(value: unknown, fallback = 0): number {
  const n = finiteNumberOr(value, fallback);
  return n < 0 ? fallback : Math.floor(n);
}

export function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly unknown[]).includes(value)
    ? (value as T)
    : fallback;
}

export function oneOfOrNull<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : null;
}

/** Keep only entries whose value is a plain object. */
export function recordOfRecords(
  value: unknown,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, entry] of Object.entries(recordOr(value))) {
    if (isRecord(entry)) out[key] = entry;
  }
  return out;
}
