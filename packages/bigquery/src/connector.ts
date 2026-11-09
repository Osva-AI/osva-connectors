import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_DEFAULT_PAGE_SIZE,
  ROWS_SAMPLE_DEFAULT_LIMIT,
  BIGQUERY_DATASET_GET_TOOL,
  BIGQUERY_DATASET_LIST_TOOL,
  BIGQUERY_PROJECT_GET_TOOL,
  BIGQUERY_TABLE_AGGREGATE_TOOL,
  BIGQUERY_TABLE_COLUMNS_LIST_TOOL,
  BIGQUERY_TABLE_GET_TOOL,
  BIGQUERY_TABLE_LIST_TOOL,
  BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
} from "./constants.js";
import { ContinuationStore, queryFingerprint } from "./continuation-store.js";
import { mapProviderError } from "./map-provider-error.js";
import {
  defaultListPageSize,
  mapColumnsListResponse,
  mapDatasetGetResponse,
  mapDatasetListResponse,
  mapQueryRowsResponse,
  mapTableGetResponse,
  mapTableListResponse,
} from "./normalize.js";
import { assertStructuredOutputWithinBudget } from "./output-budget.js";
import type { BigQueryProviderClient } from "./provider-client.js";
import {
  buildAggregateQuery,
  buildSampleQuery,
  resolveSelectColumns,
} from "./query-builder.js";
import { QueryExecutor } from "./query-executor.js";
import {
  assertColumnsPermitted,
  assertDataQueryAuthorized,
  assertDatasetAllowed,
  assertTableAllowed,
  filterDatasetsByAllowlist,
  filterTablesByAllowlist,
} from "./resource-scope.js";
import type { BigqueryConfig } from "./schemas.js";
import { validateFilterForTable } from "./structured-filters.js";
import {
  aggregateInputJsonSchema,
  aggregateInputSchema,
  columnsListInputJsonSchema,
  columnsListInputSchema,
  datasetGetInputJsonSchema,
  datasetGetInputSchema,
  datasetListInputJsonSchema,
  datasetListInputSchema,
  projectGetInputJsonSchema,
  projectGetInputSchema,
  rowsSampleInputJsonSchema,
  rowsSampleInputSchema,
  tableGetInputJsonSchema,
  tableGetInputSchema,
  tableListInputJsonSchema,
  tableListInputSchema,
} from "./tool-schemas.js";

export interface CreateBigqueryConnectorOptions {
  readonly client: BigQueryProviderClient;
  readonly config: BigqueryConfig;
  readonly continuationStore?: ContinuationStore;
  readonly queryExecutor?: QueryExecutor;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(error: unknown): ConnectorSdkError {
  return mapProviderError(error);
}

function emitBounded(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

export function createBigqueryConnector(
  options: CreateBigqueryConnectorOptions,
): DefinedConnector {
  const { client, config } = options;
  const continuations = options.continuationStore ?? new ContinuationStore();
  const executor = options.queryExecutor ?? new QueryExecutor(client, config);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Google BigQuery read-only MCP connector: bounded dataset/table discovery and parameterized SELECT sampling/aggregation.",
    tools: [
      defineTool({
        name: BIGQUERY_PROJECT_GET_TOOL,
        description: "Get configured BigQuery project metadata.",
        inputSchema: projectGetInputJsonSchema,
        handler: async (input) => {
          const parsed = projectGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const project = await client.getProject();
            return emitBounded({
              projectId: project.projectId,
              location: project.location,
            });
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: BIGQUERY_DATASET_LIST_TOOL,
        description:
          "List datasets in the configured project (allowlist filtered).",
        inputSchema: datasetListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = datasetListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = defaultListPageSize(
            parsed.data.limit,
            LIST_DEFAULT_PAGE_SIZE,
          );
          try {
            const result = await client.listDatasets({
              maxResults: limit,
              ...(parsed.data.continuationToken !== undefined
                ? { continuationToken: parsed.data.continuationToken }
                : {}),
              signal: context.signal,
            });
            const filteredIds = filterDatasetsByAllowlist(
              config.allowedDatasets,
              result.datasets.map((d) => d.datasetId),
            );
            const datasets = result.datasets.filter((d) =>
              filteredIds.includes(d.datasetId),
            );
            const payload = mapDatasetListResponse({
              datasets,
              ...(result.continuationToken !== undefined
                ? { continuationToken: result.continuationToken }
                : {}),
            });
            return emitBounded(payload);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: BIGQUERY_DATASET_GET_TOOL,
        description: "Get dataset metadata.",
        inputSchema: datasetGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = datasetGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertDatasetAllowed(config.allowedDatasets, parsed.data.datasetId);
          try {
            const dataset = await client.getDataset(
              parsed.data.datasetId,
              context.signal,
            );
            return emitBounded(mapDatasetGetResponse(dataset));
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: BIGQUERY_TABLE_LIST_TOOL,
        description: "List tables in an allowed dataset.",
        inputSchema: tableListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertDatasetAllowed(config.allowedDatasets, parsed.data.datasetId);
          const limit = defaultListPageSize(
            parsed.data.limit,
            LIST_DEFAULT_PAGE_SIZE,
          );
          try {
            const result = await client.listTables({
              datasetId: parsed.data.datasetId,
              maxResults: limit,
              ...(parsed.data.continuationToken !== undefined
                ? { continuationToken: parsed.data.continuationToken }
                : {}),
              signal: context.signal,
            });
            const filtered = filterTablesByAllowlist(
              config.allowedTables,
              parsed.data.datasetId,
              result.tables.map((t) => t.tableId),
            );
            const tables = result.tables.filter((t) =>
              filtered.includes(t.tableId),
            );
            const payload = mapTableListResponse(parsed.data.datasetId, {
              tables,
              ...(result.continuationToken !== undefined
                ? { continuationToken: result.continuationToken }
                : {}),
            });
            return emitBounded(payload);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: BIGQUERY_TABLE_GET_TOOL,
        description: "Get table metadata.",
        inputSchema: tableGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertDatasetAllowed(config.allowedDatasets, parsed.data.datasetId);
          assertTableAllowed(
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
          );
          try {
            const table = await client.getTable(
              parsed.data.datasetId,
              parsed.data.tableId,
              context.signal,
            );
            return emitBounded(
              mapTableGetResponse(parsed.data.datasetId, table),
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: BIGQUERY_TABLE_COLUMNS_LIST_TOOL,
        description: "List columns for an allowed table.",
        inputSchema: columnsListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = columnsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertDatasetAllowed(config.allowedDatasets, parsed.data.datasetId);
          assertTableAllowed(
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
          );
          try {
            let columns = await client.listTableColumns(
              parsed.data.datasetId,
              parsed.data.tableId,
              context.signal,
            );
            const allowed =
              config.allowedTables?.[parsed.data.datasetId]?.[
                parsed.data.tableId
              ];
            if (allowed !== undefined) {
              if (allowed.length === 0) {
                columns = [];
              } else {
                const allowSet = new Set(allowed);
                columns = columns.filter((col) => allowSet.has(col.name));
              }
            }
            return emitBounded(
              mapColumnsListResponse(
                parsed.data.datasetId,
                parsed.data.tableId,
                columns,
              ),
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
        description:
          "Sample rows using structured filters (server-built SELECT, dry-run capped).",
        inputSchema: rowsSampleInputJsonSchema,
        handler: async (input, context) => {
          const parsed = rowsSampleInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertDataQueryAuthorized(
            config.allowedDatasets,
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
          );
          validateFilterForTable(
            parsed.data.filter,
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
          );
          const columns = resolveSelectColumns(
            parsed.data.columns,
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
          );
          const limit = parsed.data.limit ?? ROWS_SAMPLE_DEFAULT_LIMIT;
          const built = buildSampleQuery({
            projectId: config.projectId,
            datasetId: parsed.data.datasetId,
            tableId: parsed.data.tableId,
            columns,
            limit,
            ...(parsed.data.filter !== undefined
              ? { filter: parsed.data.filter }
              : {}),
          });
          const fingerprint = queryFingerprint(built.sql, built.params);
          let pageToken: string | undefined;
          if (parsed.data.continuationToken !== undefined) {
            pageToken = continuations.resolve(parsed.data.continuationToken, {
              connectorKey: CONNECTOR_KEY,
              family: "table.rows.sample",
              datasetId: parsed.data.datasetId,
              tableId: parsed.data.tableId,
              pageSize: limit,
              queryFingerprint: fingerprint,
            });
          }
          try {
            const result = await executor.executeQuery(
              {
                sql: built.sql,
                params: built.params,
                maxResults: limit,
                ...(pageToken !== undefined ? { pageToken } : {}),
                signal: context.signal,
              },
              context.signal,
            );
            let continuationToken: string | undefined;
            if (result.pageToken !== undefined) {
              continuationToken = continuations.issue(
                {
                  connectorKey: CONNECTOR_KEY,
                  family: "table.rows.sample",
                  datasetId: parsed.data.datasetId,
                  tableId: parsed.data.tableId,
                  pageSize: limit,
                  queryFingerprint: fingerprint,
                },
                result.pageToken,
              );
            }
            return emitBounded(
              mapQueryRowsResponse(
                parsed.data.datasetId,
                parsed.data.tableId,
                result.rows,
                continuationToken,
              ),
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: BIGQUERY_TABLE_AGGREGATE_TOOL,
        description:
          "Run bounded aggregation (max 2 group-by columns, structured filters).",
        inputSchema: aggregateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = aggregateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertDataQueryAuthorized(
            config.allowedDatasets,
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
          );
          validateFilterForTable(
            parsed.data.filter,
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
          );
          const metricColumns = parsed.data.metrics
            .map((metric) => metric.column)
            .filter((col): col is string => col !== undefined);
          const groupBy = parsed.data.groupBy ?? [];
          assertColumnsPermitted(
            config.allowedTables,
            parsed.data.datasetId,
            parsed.data.tableId,
            [...groupBy, ...metricColumns],
          );
          const built = buildAggregateQuery({
            projectId: config.projectId,
            datasetId: parsed.data.datasetId,
            tableId: parsed.data.tableId,
            metrics: parsed.data.metrics,
            ...(parsed.data.groupBy !== undefined
              ? { groupBy: parsed.data.groupBy }
              : {}),
            ...(parsed.data.filter !== undefined
              ? { filter: parsed.data.filter }
              : {}),
            limit: parsed.data.limit ?? 100,
          });
          try {
            const result = await executor.executeQuery(
              {
                sql: built.sql,
                params: built.params,
                maxResults: parsed.data.limit ?? 100,
                signal: context.signal,
              },
              context.signal,
            );
            return emitBounded(
              mapQueryRowsResponse(
                parsed.data.datasetId,
                parsed.data.tableId,
                result.rows,
              ),
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
    ],
  });
}
