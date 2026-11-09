import type {
  BigQueryColumnInfo,
  BigQueryDatasetInfo,
  BigQueryDatasetListResult,
  BigQueryDatasetSummary,
  BigQueryProjectInfo,
  BigQueryProviderClient,
  BigQueryTableInfo,
  BigQueryTableListResult,
  QueryDryRunResult,
  QueryExecutionOptions,
  QueryExecutionResult,
} from "../../src/provider-client.js";

export interface FakeTable {
  readonly columns: readonly BigQueryColumnInfo[];
  readonly rows: readonly Record<string, unknown>[];
}

export class FakeBigQueryProviderClient implements BigQueryProviderClient {
  dryRunCallCount = 0;
  runQueryCallCount = 0;
  lastDryRunSql?: string;
  lastRunSql?: string;

  readonly project: BigQueryProjectInfo;
  readonly datasets = new Map<string, BigQueryDatasetSummary>();
  readonly tables = new Map<string, FakeTable>();

  constructor(project?: Partial<BigQueryProjectInfo>) {
    this.project = {
      projectId: project?.projectId ?? "fixture-project",
      location: project?.location ?? "US",
    };
    this.datasets.set("analytics", {
      datasetId: "analytics",
      friendlyName: "Analytics",
      location: "US",
    });
    this.tables.set("analytics.events", {
      columns: [
        { name: "event_name", type: "STRING", mode: "REQUIRED" },
        { name: "user_id", type: "STRING" },
        { name: "value", type: "INT64" },
      ],
      rows: [
        { event_name: "signup", user_id: "u1", value: 1 },
        { event_name: "purchase", user_id: "u2", value: 99 },
        { event_name: "purchase", user_id: "u3", value: 50 },
      ],
    });
  }

  private tableKey(datasetId: string, tableId: string): string {
    return `${datasetId}.${tableId}`;
  }

  async getProject(): Promise<BigQueryProjectInfo> {
    return this.project;
  }

  async listDatasets(params: {
    maxResults: number;
    continuationToken?: string;
  }): Promise<BigQueryDatasetListResult> {
    const ids = [...this.datasets.keys()].sort();
    const start =
      params.continuationToken === undefined
        ? 0
        : Number(params.continuationToken);
    const slice = ids.slice(start, start + params.maxResults);
    const datasets = slice
      .map((id) => this.datasets.get(id))
      .filter((d): d is BigQueryDatasetSummary => d !== undefined);
    const next = start + params.maxResults;
    return {
      datasets,
      ...(next < ids.length ? { continuationToken: String(next) } : {}),
    };
  }

  async getDataset(datasetId: string): Promise<BigQueryDatasetInfo> {
    const found = this.datasets.get(datasetId);
    if (found === undefined) {
      const error = Object.assign(new Error("Not found"), { code: 404 });
      throw error;
    }
    return { ...found, description: "fixture dataset" };
  }

  async listTables(params: {
    datasetId: string;
    maxResults: number;
    continuationToken?: string;
  }): Promise<BigQueryTableListResult> {
    const prefix = `${params.datasetId}.`;
    const ids = [...this.tables.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort();
    const start =
      params.continuationToken === undefined
        ? 0
        : Number(params.continuationToken);
    const slice = ids.slice(start, start + params.maxResults);
    const next = start + params.maxResults;
    return {
      tables: slice.map((tableId) => ({ tableId, type: "TABLE" })),
      ...(next < ids.length ? { continuationToken: String(next) } : {}),
    };
  }

  async getTable(
    datasetId: string,
    tableId: string,
  ): Promise<BigQueryTableInfo> {
    const table = this.tables.get(this.tableKey(datasetId, tableId));
    if (table === undefined) {
      const error = Object.assign(new Error("Not found"), { code: 404 });
      throw error;
    }
    return {
      tableId,
      type: "TABLE",
      numRows: String(table.rows.length),
      schemaFields: table.columns,
    };
  }

  async listTableColumns(
    datasetId: string,
    tableId: string,
  ): Promise<readonly BigQueryColumnInfo[]> {
    const table = this.tables.get(this.tableKey(datasetId, tableId));
    if (table === undefined) {
      const error = Object.assign(new Error("Not found"), { code: 404 });
      throw error;
    }
    return table.columns;
  }

  async dryRunQuery(
    options: QueryExecutionOptions,
  ): Promise<QueryDryRunResult> {
    this.dryRunCallCount += 1;
    this.lastDryRunSql = options.sql;
    if (options.sql.toLowerCase().includes("drop ")) {
      throw new Error("Rejected");
    }
    return { bytesProcessed: 1024 };
  }

  async runQuery(
    options: QueryExecutionOptions,
  ): Promise<QueryExecutionResult> {
    this.runQueryCallCount += 1;
    this.lastRunSql = options.sql;
    const match = /`([^`]+)`\.`([^`]+)`\.`([^`]+)`/u.exec(options.sql);
    if (match === null) {
      return { rows: [] };
    }
    const [, , datasetId, tableId] = match;
    const table = this.tables.get(`${datasetId}.${tableId}`);
    const rows = table?.rows ?? [];
    const max = options.maxResults ?? rows.length;
    const start =
      options.pageToken === undefined ? 0 : Number(options.pageToken);
    const slice = [...rows].slice(start, start + max);
    const next = start + max;
    return {
      rows: slice.map((row) => ({ ...row })),
      ...(next < rows.length ? { pageToken: String(next) } : {}),
      totalRows: rows.length,
    };
  }
}
