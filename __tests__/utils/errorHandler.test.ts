import { errorHandler, AppError } from "@/utils/errorHandler";
import { reportError } from "@/utils/crash-reporting";

jest.mock("@/utils/crash-reporting", () => ({
  reportError: jest.fn(),
}));

describe("errorHandler", () => {
  beforeEach(() => {
    errorHandler.clearLogs();
    jest.mocked(reportError).mockClear();
  });

  it("should log errors with context", () => {
    const error = new Error("Test error");
    const context = { userId: "123" };

    errorHandler.log(error, "error", context);

    const logs = errorHandler.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("Test error");
    expect(logs[0].context).toEqual(context);
  });

  it("should log string errors", () => {
    errorHandler.log("String error", "warning");

    const logs = errorHandler.getLogs();
    expect(logs[0].message).toBe("String error");
    expect(logs[0].severity).toBe("warning");
  });

  it("should clear error logs", () => {
    errorHandler.log("Error 1", "error");
    errorHandler.log("Error 2", "error");

    expect(errorHandler.getLogs()).toHaveLength(2);

    errorHandler.clearLogs();

    expect(errorHandler.getLogs()).toHaveLength(0);
  });

  it("should handle async operations successfully", async () => {
    const result = await errorHandler.tryAsync(async () => {
      return { success: true };
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ success: true });
    expect(result.error).toBeUndefined();
  });

  it("should handle async operation errors", async () => {
    const result = await errorHandler.tryAsync(async () => {
      throw new Error("Async error");
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it("should provide user-friendly error messages", () => {
    const authError = new AppError("AUTH_ERROR", "Auth failed");
    const networkError = new AppError("NETWORK_ERROR", "Network failed");

    expect(errorHandler.getUserMessage(authError)).toContain(
      "Authentication failed",
    );
    expect(errorHandler.getUserMessage(networkError)).toContain(
      "Connection failed",
    );
  });

  it("forwards logged errors to crash reporting", () => {
    const error = new Error("store write failed");
    errorHandler.log(error, "error", { store: "player" });

    expect(reportError).toHaveBeenCalledWith(error, { store: "player" }, "error-handler");
  });

  it("does not report warnings as crashes", () => {
    errorHandler.log("not urgent", "warning");
    expect(reportError).not.toHaveBeenCalled();
  });

  it("should handle unknown errors gracefully", () => {
    const message = errorHandler.getUserMessage("Unknown error");
    expect(message).toBe("Unknown error");
  });
});
