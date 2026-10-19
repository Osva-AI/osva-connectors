import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  createTotalDeadlineError,
  PostgresOperationContext,
} from "../src/operation-context.js";

describe("PostgresOperationContext", () => {
  it("rejects when the total deadline elapses", async () => {
    vi.useFakeTimers();
    const operation = new PostgresOperationContext(100);
    const pending = operation.race(
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("late"), 500);
      }),
    );
    vi.advanceTimersByTime(150);
    await expect(pending).rejects.toMatchObject({
      code: "TIMEOUT",
      message: createTotalDeadlineError().message,
    });
    vi.useRealTimers();
  });

  it("rejects when the MCP signal aborts", async () => {
    const controller = new AbortController();
    const operation = new PostgresOperationContext(5_000, controller.signal);
    const pending = operation.race(
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("late"), 500);
      }),
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("clears deadline timers after success", async () => {
    vi.useFakeTimers();
    const operation = new PostgresOperationContext(1_000);
    await operation.race(Promise.resolve("ok"));
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("throws TIMEOUT ConnectorSdkError for expired deadlines", () => {
    vi.useFakeTimers();
    const operation = new PostgresOperationContext(50);
    vi.advanceTimersByTime(60);
    expect(() => operation.assertActive()).toThrow(ConnectorSdkError);
    vi.useRealTimers();
  });
});
