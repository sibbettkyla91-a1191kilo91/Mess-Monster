describe("crash-reporting", () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("stays quiet when no DSN is configured", () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    jest.resetModules();

    const Sentry = require("@sentry/react-native");
    const {
      initCrashReporting,
      reportError,
      isCrashReportingEnabled,
    } = require("@/utils/crash-reporting");

    initCrashReporting();
    reportError(new Error("should not send"));

    expect(isCrashReportingEnabled()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("inits Sentry and reports exceptions when a DSN is set", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN =
      "https://public@o0.ingest.sentry.io/0";
    jest.resetModules();

    const Sentry = require("@sentry/react-native");
    const {
      initCrashReporting,
      reportError,
      isCrashReportingEnabled,
    } = require("@/utils/crash-reporting");

    initCrashReporting();
    expect(isCrashReportingEnabled()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@o0.ingest.sentry.io/0",
        sendDefaultPii: false,
        tracesSampleRate: 0,
      }),
    );

    const err = new Error("wild crash");
    reportError(err, { where: "test" }, "error-boundary");

    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        extra: { where: "test" },
        tags: { source: "error-boundary" },
      }),
    );
  });
});
