import { BigQuery, type Job } from "@google-cloud/bigquery";

import type {
  BigQueryColumnInfo,
  BigQueryDatasetInfo,
  BigQueryDatasetListResult,
  BigQueryDatasetSummary,
  BigQueryProjectInfo,
  BigQueryProviderClient,
  BigQueryTableInfo,
  BigQueryTableListResult,
  BigQueryTableSummary,
  QueryDryRunResult,
  QueryExecutionOptions,
  QueryExecutionResult,
} from "./provider-client.js";
import { createRequestAbortSignal } from "./request-abort-signal.js";
import {
  cancelBigQueryJobBestEffort,
  runWithAbortSignal,
} from "./run-with-abort.js";

export interface CreateBigQuerySdkClientOptions {
  readonly projectId: string;
  readonly location: string;
  readonly requestTimeoutMs: number;
  readonly bigquery?: BigQuery;
}

function mapColumnField(field: {
  name?: string;
  type?: string;
  mode?: string;
  description?: string;
}): BigQueryColumnInfo | undefined {
  if (field.name === undefined || field.type === undefined) {
    return undefined;
  }
  return {
    name: field.name,
    type: field.type,
    ...(field.mode !== undefined ? { mode: field.mode } : {}),
    ...(field.description !== undefined
      ? { description: field.description }
      : {}),
  };
}

function requestSignal(
  requestTimeoutMs: number,
  parent?: AbortSignal,
): AbortSignal {
  return createRequestAbortSignal(requestTimeoutMs, parent);
}

async function runQueryJobLifecycle(
  bigquery: BigQuery,
  requestTimeoutMs: number,
  jobOptions: {
    query: string;
    params?: Record<string, unknown>;
    location?: string;
    maxBytesBilled?: string;
    jobTimeoutMs?: number;
    dryRun?: boolean;
  },
  resultsOptions: {
    maxResults?: number;
    pageToken?: string;
  },
  parentSignal?: AbortSignal,
): Promise<{
  job?: Job;
  rows: Record<string, unknown>[];
  pageToken?: string;
  totalRows?: number;
  dryRunBytes?: number;
}> {
  const signal = requestSignal(requestTimeoutMs, parentSignal);
  let job: Job | undefined;
  try {
    const [createdJob] = await runWithAbortSignal(signal, () =>
      bigquery.createQueryJob({
        query: jobOptions.query,
        params: jobOptions.params,
        location: jobOptions.location,
        maximumBytesBilled: jobOptions.maxBytesBilled,
        jobTimeoutMs: jobOptions.jobTimeoutMs,
        dryRun: jobOptions.dryRun,
      }),
    );
    if (jobOptions.dryRun) {
      const stats = createdJob.metadata?.statistics?.query;
      const processed = Number(stats?.totalBytesProcessed ?? 0);
      return {
        rows: [],
        dryRunBytes: Number.isFinite(processed) ? processed : 0,
      };
    }
    job = createdJob;
    const [rows, , response] = await runWithAbortSignal(signal, () =>
      job!.getQueryResults({
        maxResults: resultsOptions.maxResults,
        pageToken: resultsOptions.pageToken,
        autoPaginate: false,
      }),
    );
    const pageToken = (response as { pageToken?: string } | undefined)
      ?.pageToken;
    const plain = rows.map((row) => ({ ...row }));
    const totalRows = job.metadata?.statistics?.query?.totalRows;
    return {
      job,
      rows: plain,
      ...(pageToken !== undefined ? { pageToken } : {}),
      ...(totalRows !== undefined ? { totalRows: Number(totalRows) } : {}),
    };
  } catch (error) {
    if (job !== undefined) {
      await cancelBigQueryJobBestEffort(job);
    }
    throw error;
  }
}

export function createBigQuerySdkProviderClient(
  options: CreateBigQuerySdkClientOptions,
): BigQueryProviderClient {
  const requestTimeoutMs = options.requestTimeoutMs;
  const bigquery =
    options.bigquery ?? new BigQuery({ projectId: options.projectId });

  return {
    async getProject(): Promise<BigQueryProjectInfo> {
      return {
        projectId: options.projectId,
        location: options.location,
      };
    },

    async listDatasets(params): Promise<BigQueryDatasetListResult> {
      const signal = requestSignal(requestTimeoutMs, params.signal);
      const [datasets, , response] = await runWithAbortSignal(signal, () =>
        bigquery.getDatasets({
          maxResults: params.maxResults,
          pageToken: params.continuationToken,
          autoPaginate: false,
        }),
      );
      const summaries: BigQueryDatasetSummary[] = datasets.map((dataset) => ({
        datasetId: dataset.id ?? "",
        ...(dataset.metadata?.friendlyName !== undefined
          ? { friendlyName: String(dataset.metadata.friendlyName) }
          : {}),
        ...(dataset.location !== undefined
          ? { location: dataset.location }
          : {}),
      }));
      const token = (response as { pageToken?: string } | undefined)?.pageToken;
      return {
        datasets: summaries.filter((d) => d.datasetId.length > 0),
        ...(token !== undefined ? { continuationToken: token } : {}),
      };
    },

    async getDataset(datasetId, signal): Promise<BigQueryDatasetInfo> {
      const budget = requestSignal(requestTimeoutMs, signal);
      budget.throwIfAborted?.();
      const [metadata] = await runWithAbortSignal(budget, () =>
        bigquery.dataset(datasetId).getMetadata(),
      );
      return {
        datasetId,
        ...(metadata.friendlyName !== undefined
          ? { friendlyName: String(metadata.friendlyName) }
          : {}),
        ...(metadata.location !== undefined
          ? { location: String(metadata.location) }
          : {}),
        ...(metadata.description !== undefined
          ? { description: String(metadata.description) }
          : {}),
      };
    },

    async listTables(params): Promise<BigQueryTableListResult> {
      const signal = requestSignal(requestTimeoutMs, params.signal);
      const [tables, , response] = await runWithAbortSignal(signal, () =>
        bigquery.dataset(params.datasetId).getTables({
          maxResults: params.maxResults,
          pageToken: params.continuationToken,
          autoPaginate: false,
        }),
      );
      const summaries: BigQueryTableSummary[] = tables.map((table) => ({
        tableId: table.id ?? "",
        ...(table.metadata?.type !== undefined
          ? { type: String(table.metadata.type) }
          : {}),
      }));
      const token = (response as { pageToken?: string } | undefined)?.pageToken;
      return {
        tables: summaries.filter((t) => t.tableId.length > 0),
        ...(token !== undefined ? { continuationToken: token } : {}),
      };
    },

    async getTable(datasetId, tableId, signal): Promise<BigQueryTableInfo> {
      const budget = requestSignal(requestTimeoutMs, signal);
      budget.throwIfAborted?.();
      const [metadata] = await runWithAbortSignal(budget, () =>
        bigquery.dataset(datasetId).table(tableId).getMetadata(),
      );
      const fields = Array.isArray(metadata.schema?.fields)
        ? (
            metadata.schema.fields as Array<{
              name?: string;
              type?: string;
              mode?: string;
              description?: string;
            }>
          )
            .map((field) => mapColumnField(field))
            .filter((f): f is BigQueryColumnInfo => f !== undefined)
        : undefined;
      return {
        tableId,
        ...(metadata.type !== undefined ? { type: String(metadata.type) } : {}),
        ...(metadata.description !== undefined
          ? { description: String(metadata.description) }
          : {}),
        ...(metadata.numRows !== undefined
          ? { numRows: String(metadata.numRows) }
          : {}),
        ...(metadata.numBytes !== undefined
          ? { numBytes: String(metadata.numBytes) }
          : {}),
        ...(fields !== undefined ? { schemaFields: fields } : {}),
      };
    },

    async listTableColumns(datasetId, tableId, signal) {
      const table = await this.getTable(datasetId, tableId, signal);
      return table.schemaFields ?? [];
    },

    async dryRunQuery(
      options: QueryExecutionOptions,
    ): Promise<QueryDryRunResult> {
      const result = await runQueryJobLifecycle(
        bigquery,
        requestTimeoutMs,
        {
          query: options.sql,
          params: options.params,
          location: options.location,
          maxBytesBilled: options.maxBytesBilled?.toString(),
          jobTimeoutMs: options.timeoutMs,
          dryRun: true,
        },
        {},
        options.signal,
      );
      return { bytesProcessed: result.dryRunBytes ?? 0 };
    },

    async runQuery(
      options: QueryExecutionOptions,
    ): Promise<QueryExecutionResult> {
      const result = await runQueryJobLifecycle(
        bigquery,
        requestTimeoutMs,
        {
          query: options.sql,
          params: options.params,
          location: options.location,
          maxBytesBilled: options.maxBytesBilled?.toString(),
          jobTimeoutMs: options.timeoutMs,
        },
        {
          maxResults: options.maxResults,
          pageToken: options.pageToken,
        },
        options.signal,
      );
      return {
        rows: result.rows,
        ...(result.pageToken !== undefined
          ? { pageToken: result.pageToken }
          : {}),
        ...(result.totalRows !== undefined
          ? { totalRows: result.totalRows }
          : {}),
      };
    },
  };
}
