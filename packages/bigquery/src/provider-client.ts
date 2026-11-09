export interface BigQueryProjectInfo {
  readonly projectId: string;
  readonly location: string;
}

export interface BigQueryDatasetSummary {
  readonly datasetId: string;
  readonly friendlyName?: string;
  readonly location?: string;
}

export interface BigQueryDatasetListResult {
  readonly datasets: readonly BigQueryDatasetSummary[];
  readonly continuationToken?: string;
}

export interface BigQueryDatasetInfo extends BigQueryDatasetSummary {
  readonly description?: string;
  readonly defaultTableExpirationMs?: string;
}

export interface BigQueryTableSummary {
  readonly tableId: string;
  readonly type?: string;
}

export interface BigQueryTableListResult {
  readonly tables: readonly BigQueryTableSummary[];
  readonly continuationToken?: string;
}

export interface BigQueryTableInfo extends BigQueryTableSummary {
  readonly description?: string;
  readonly numRows?: string;
  readonly numBytes?: string;
  readonly schemaFields?: readonly BigQueryColumnInfo[];
}

export interface BigQueryColumnInfo {
  readonly name: string;
  readonly type: string;
  readonly mode?: string;
  readonly description?: string;
}

export interface QueryExecutionOptions {
  readonly sql: string;
  readonly params?: Record<string, unknown>;
  readonly maxResults?: number;
  readonly pageToken?: string;
  readonly location?: string;
  readonly maxBytesBilled?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface QueryDryRunResult {
  readonly bytesProcessed: number;
}

export interface QueryExecutionResult {
  readonly rows: readonly Record<string, unknown>[];
  readonly pageToken?: string;
  readonly totalRows?: number;
}

export interface BigQueryProviderClient {
  getProject(): Promise<BigQueryProjectInfo>;

  listDatasets(params: {
    maxResults: number;
    continuationToken?: string;
    signal?: AbortSignal;
  }): Promise<BigQueryDatasetListResult>;

  getDataset(
    datasetId: string,
    signal?: AbortSignal,
  ): Promise<BigQueryDatasetInfo>;

  listTables(params: {
    datasetId: string;
    maxResults: number;
    continuationToken?: string;
    signal?: AbortSignal;
  }): Promise<BigQueryTableListResult>;

  getTable(
    datasetId: string,
    tableId: string,
    signal?: AbortSignal,
  ): Promise<BigQueryTableInfo>;

  listTableColumns(
    datasetId: string,
    tableId: string,
    signal?: AbortSignal,
  ): Promise<readonly BigQueryColumnInfo[]>;

  dryRunQuery(options: QueryExecutionOptions): Promise<QueryDryRunResult>;

  runQuery(options: QueryExecutionOptions): Promise<QueryExecutionResult>;
}
