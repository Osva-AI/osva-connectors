import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it, vi } from "vitest";

import { recordToolExecution } from "../src/execution-telemetry.js";
import { POSTGRES_QUERY_READ_TOOL } from "../src/constants.js";

describe("recordToolExecution", () => {
  it("emits sanitized success events without SQL or credentials", async () => {
    const sink = vi.fn();
    await recordToolExecution({
      tool: POSTGRES_QUERY_READ_TOOL,
      sink,
      connectMsRef: { connectMs: 12 },
      execute: async () => ({ rowCount: 3, truncated: false }),
      extractMetrics: (result) => result,
    });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: POSTGRES_QUERY_READ_TOOL,
        outcome: "success",
        rowCount: 3,
        connectMs: 12,
      }),
    );
    expect(JSON.stringify(sink.mock.calls)).not.toContain("postgresql://");
  });

  it("classifies cancellation without raw provider errors", async () => {
    const sink = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      recordToolExecution({
        tool: POSTGRES_QUERY_READ_TOOL,
        sink,
        execute: async () => {
          throw (
            controller.signal.reason ??
            new DOMException("Aborted", "AbortError")
          );
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "cancelled",
        errorCategory: "CANCELLED",
      }),
    );
  });

  it("classifies total deadline failures as timeout", async () => {
    const sink = vi.fn();
    await expect(
      recordToolExecution({
        tool: POSTGRES_QUERY_READ_TOOL,
        sink,
        execute: async () => {
          throw new ConnectorSdkError(
            "TIMEOUT",
            "PostgreSQL request exceeded the total operation deadline.",
          );
        },
      }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "timeout", errorCategory: "TIMEOUT" }),
    );
  });
});
