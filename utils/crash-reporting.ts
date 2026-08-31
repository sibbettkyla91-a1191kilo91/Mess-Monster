import type { ComponentType } from "react";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

type ExpoExtra = { sentryDsn?: string };

function getDsn(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  return extra?.sentryDsn?.trim() ?? "";
}

let didInit = false;

/**
 * Turn on Sentry when a DSN is present. No DSN means a quiet no-op so
 * local work and CI stay unchanged until the owner pastes their key.
 */
export function initCrashReporting(): void {
  if (didInit) return;
  didInit = true;

  const dsn = getDsn();
  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableLogs: false,
    environment: __DEV__ ? "development" : "production",
  });
}

export function isCrashReportingEnabled(): boolean {
  return getDsn().length > 0;
}

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
  source = "app",
): void {
  if (!getDsn()) return;
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(err, {
    extra: context,
    tags: { source },
  });
}

export function wrapRoot<T extends ComponentType<unknown>>(component: T): T {
  return Sentry.wrap(component) as T;
}
