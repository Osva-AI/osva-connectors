import type {
  BigQueryDatasetInfo,
  BigQueryDatasetListResult,
  BigQueryTableInfo,
  BigQueryTableListResult,
} from "./provider-client.js";

export function mapDatasetListResponse(
  result: BigQueryDatasetListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    datasets: result.datasets.map((dataset) => ({
      datasetId: dataset.datasetId,
      ...(dataset.friendlyName !== undefined
        ? { friendlyName: dataset.friendlyName }
        : {}),
      ...(dataset.location !== undefined ? { location: dataset.location } : {}),
    })),
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function mapDatasetGetResponse(
  dataset: BigQueryDatasetInfo,
): Record<string, unknown> {
  return {
    datasetId: dataset.datasetId,
    ...(dataset.friendlyName !== undefined
      ? { friendlyName: dataset.friendlyName }
      : {}),
    ...(dataset.location !== undefined ? { location: dataset.location } : {}),
    ...(dataset.description !== undefined
      ? { description: dataset.description }
      : {}),
  };
}

export function mapTableListResponse(
  datasetId: string,
  result: BigQueryTableListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    datasetId,
    tables: result.tables.map((table) => ({
      tableId: table.tableId,
      ...(table.type !== undefined ? { type: table.type } : {}),
    })),
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function mapTableGetResponse(
  datasetId: string,
  table: BigQueryTableInfo,
): Record<string, unknown> {
  return {
    datasetId,
    tableId: table.tableId,
    ...(table.type !== undefined ? { type: table.type } : {}),
    ...(table.description !== undefined
      ? { description: table.description }
      : {}),
    ...(table.numRows !== undefined ? { numRows: table.numRows } : {}),
    ...(table.numBytes !== undefined ? { numBytes: table.numBytes } : {}),
  };
}

export function mapColumnsListResponse(
  datasetId: string,
  tableId: string,
  columns: readonly {
    name: string;
    type: string;
    mode?: string;
    description?: string;
  }[],
): Record<string, unknown> {
  return {
    datasetId,
    tableId,
    columns: columns.map((column) => ({
      name: column.name,
      type: column.type,
      ...(column.mode !== undefined ? { mode: column.mode } : {}),
      ...(column.description !== undefined
        ? { description: column.description }
        : {}),
    })),
  };
}

export function mapQueryRowsResponse(
  datasetId: string,
  tableId: string,
  rows: readonly Record<string, unknown>[],
  continuationToken?: string,
): Record<string, unknown> {
  return {
    datasetId,
    tableId,
    rows,
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function defaultListPageSize(
  limit: number | undefined,
  fallback: number,
): number {
  return limit ?? fallback;
}
