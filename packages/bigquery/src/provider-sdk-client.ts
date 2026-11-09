import { BigQuery } from "@google-cloud/bigquery";

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

export function createBigQuerySdkProviderClient(
  options: CreateBigQuerySdkClientOptions,
): BigQueryProviderClient {
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
      const [datasets, , response] = await bigquery.getDatasets({
        maxResults: params.maxResults,
        pageToken: params.continuationToken,
        autoPaginate: false,
      });
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
      signal?.throwIfAborted?.();
      const [metadata] = await bigquery.dataset(datasetId).getMetadata();
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
      const [tables, , response] = await bigquery
        .dataset(params.datasetId)
        .getTables({
          maxResults: params.maxResults,
          pageToken: params.continuationToken,
          autoPaginate: false,
        });
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
      signal?.throwIfAborted?.();
      const [metadata] = await bigquery
        .dataset(datasetId)
        .table(tableId)
        .getMetadata();
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
      const [job] = await bigquery.createQueryJob({
        query: options.sql,
        params: options.params,
        dryRun: true,
        location: options.location,
        maximumBytesBilled: options.maxBytesBilled?.toString(),
        jobTimeoutMs: options.timeoutMs,
      });
      const stats = job.metadata?.statistics?.query;
      const processed = Number(stats?.totalBytesProcessed ?? 0);
      return { bytesProcessed: Number.isFinite(processed) ? processed : 0 };
    },

    async runQuery(
      options: QueryExecutionOptions,
    ): Promise<QueryExecutionResult> {
      const [job] = await bigquery.createQueryJob({
        query: options.sql,
        params: options.params,
        location: options.location,
        maximumBytesBilled: options.maxBytesBilled?.toString(),
        jobTimeoutMs: options.timeoutMs,
      });
      const [rows, , response] = await job.getQueryResults({
        maxResults: options.maxResults,
        pageToken: options.pageToken,
        autoPaginate: false,
      });
      const pageToken = (response as { pageToken?: string } | undefined)
        ?.pageToken;
      const plain = rows.map((row) => ({ ...row }));
      const totalRows = job.metadata?.statistics?.query?.totalRows;
      return {
        rows: plain,
        ...(pageToken !== undefined ? { pageToken } : {}),
        ...(totalRows !== undefined ? { totalRows: Number(totalRows) } : {}),
      };
    },
  };
}
