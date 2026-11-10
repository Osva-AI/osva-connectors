import type { BigQuery, Job } from "@google-cloud/bigquery";
import { describe, expect, it, vi } from "vitest";

import { createBigQuerySdkProviderClient } from "../src/provider-sdk-client.js";

function createMockJob(overrides?: {
  cancel?: () => Promise<unknown>;
  rows?: Record<string, unknown>[];
}): Job {
  const cancel =
    overrides?.cancel ?? vi.fn(async () => [{ reason: "stopped" }]);
  const job = {
    metadata: {
      statistics: {
        query: { totalRows: String(overrides?.rows?.length ?? 0) },
      },
    },
    cancel,
    getQueryResults: vi.fn(async () => [
      overrides?.rows ?? [{ ok: true }],
      {},
      {},
    ]),
  } as unknown as Job;
  return job;
}

describe("BigQuery SDK request budget", () => {
  it("applies requestTimeoutMs by passing through listDatasets", async () => {
    const getDatasets = vi.fn(async () => [
      [{ id: "analytics", metadata: {}, location: "US" }],
      {},
      {},
    ]);
    const bigquery = { getDatasets } as unknown as BigQuery;
    const client = createBigQuerySdkProviderClient({
      projectId: "proj",
      location: "US",
      requestTimeoutMs: 4_000,
      bigquery,
    });

    const result = await client.listDatasets({ maxResults: 10 });
    expect(result.datasets).toHaveLength(1);
    expect(getDatasets).toHaveBeenCalledWith({
      maxResults: 10,
      pageToken: undefined,
      autoPaginate: false,
    });
  });

  it("cancels the job when execute is aborted before results", async () => {
    const job = createMockJob();
    const createQueryJob = vi.fn(async () => [job]);
    Object.assign(job, {
      getQueryResults: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [[{ row: 1 }], {}, {}];
      }),
    });
    const bigquery = { createQueryJob } as unknown as BigQuery;
    const client = createBigQuerySdkProviderClient({
      projectId: "proj",
      location: "US",
      requestTimeoutMs: 25,
      bigquery,
    });
    const controller = new AbortController();

    const pending = client.runQuery({
      sql: "SELECT 1",
      timeoutMs: 30_000,
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(job.cancel).toHaveBeenCalled();
  });

  it("dry-run uses jobTimeoutMs and returns bytes processed", async () => {
    const job = createMockJob();
    job.metadata = {
      statistics: {
        query: { totalBytesProcessed: "42" },
      },
    };
    const createQueryJob = vi.fn(async () => [job]);
    const bigquery = { createQueryJob } as unknown as BigQuery;
    const client = createBigQuerySdkProviderClient({
      projectId: "proj",
      location: "US",
      requestTimeoutMs: 5_000,
      bigquery,
    });

    const dry = await client.dryRunQuery({
      sql: "SELECT 1",
      timeoutMs: 1_000,
    });
    expect(dry.bytesProcessed).toBe(42);
    expect(createQueryJob).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, jobTimeoutMs: 1_000 }),
    );
  });
});
