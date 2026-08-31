/**
 * Centralised error handling utility for Mess Monster.
 */

import { reportError } from "@/utils/crash-reporting";

export type Severity = "error" | "warning" | "info";

export interface LogEntry {
  message: string;
  severity: Severity;
  context?: Record<string, unknown>;
  timestamp: number;
}

export interface TryAsyncResult<T> {
  success: boolean;
  data?: T;
  error?: LogEntry;
}

/** Typed application error with a machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const USER_MESSAGES: Record<string, string> = {
  AUTH_ERROR: "Authentication failed. Please try signing in again.",
  NETWORK_ERROR: "Connection failed. Check your internet and try again.",
  STORAGE_ERROR: "Could not save your data. Please try again.",
};

class ErrorHandler {
  private logs: LogEntry[] = [];

  /** Record an error or warning with optional context. */
  log(
    error: Error | string,
    severity: Severity = "error",
    context?: Record<string, unknown>,
  ): void {
    const message = error instanceof Error ? error.message : error;
    this.logs.push({ message, severity, context, timestamp: Date.now() });
    if (severity === "error") {
      reportError(error, context, "error-handler");
    }
  }

  /** Return all recorded log entries. */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /** Clear all recorded log entries. */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Wrap an async operation: catches errors, logs them, and returns a
   * structured result so callers never need to try/catch.
   */
  async tryAsync<T>(fn: () => Promise<T>): Promise<TryAsyncResult<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (err) {
      const caught = err instanceof Error ? err : new Error(String(err));
      this.log(caught, "error");
      return { success: false, error: this.logs[this.logs.length - 1] };
    }
  }

  /**
   * Convert any thrown value into a user-friendly string.
   * AppError codes get translated; plain strings are returned as-is.
   */
  getUserMessage(error: unknown): string {
    if (error instanceof AppError) {
      return USER_MESSAGES[error.code] ?? error.message;
    }
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Something went wrong. Please try again.";
  }
}

export const errorHandler = new ErrorHandler();
