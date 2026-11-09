import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  buildColumnsListSql,
  buildSchemaGetSql,
  buildSchemaListQuery,
  buildTableGetSql,
  buildTableListSql,
} from "./catalog-sql.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_DEFAULT_PAGE_SIZE,
  SNOWFLAKE_DATABASE_GET_TOOL,
  SNOWFLAKE_SCHEMA_GET_TOOL,
  SNOWFLAKE_SCHEMA_LIST_TOOL,
  SNOWFLAKE_TABLE_AGGREGATE_TOOL,
  SNOWFLAKE_TABLE_COLUMNS_LIST_TOOL,
  SNOWFLAKE_TABLE_GET_TOOL,
  SNOWFLAKE_TABLE_LIST_TOOL,
  SNOWFLAKE_TABLE_ROWS_SAMPLE_TOOL,
} from "./constants.js";
import { ContinuationStore } from "./continuation-store.js";
import { mapSnowflakeError } from "./map-provider-error.js";
import {
  defaultListPageSize,
  defaultSampleRowLimit,
  mapListResponse,
  parseProviderOffset,
} from "./normalize.js";
import { assertStructuredOutputWithinBudget } from "./output-budget.js";
import type { SnowflakeProviderClient } from "./provider-client.js";
import { QueryConcurrencyGate } from "./query-gate.js";
import {
  buildAggregateSelectQuery,
  buildSampleSelectQuery,
  normalizeAggregateMetrics,
  normalizeFilters,
  normalizeGroupBy,
  type StructuredFilter,
} from "./query-builder.js";
import {
  assertColumnAllowed,
  assertColumnsAllowed,
  assertSchemaAllowed,
  assertTableAllowed,
  resolveAllowedColumnsForTable,
} from "./resource-scope.js";
import type { SnowflakeConfig } from "./schemas.js";
import {
  columnsListInputJsonSchema,
  columnsListInputSchema,
  databaseGetInputJsonSchema,
  databaseGetInputSchema,
  rowsSampleInputJsonSchema,
  rowsSampleInputSchema,
  schemaGetInputJsonSchema,
  schemaGetInputSchema,
  schemaListInputJsonSchema,
  schemaListInputSchema,
  tableAggregateInputJsonSchema,
  tableAggregateInputSchema,
  tableGetInputJsonSchema,
  tableGetInputSchema,
  tableListInputJsonSchema,
  tableListInputSchema,
} from "./tool-schemas.js";

export interface CreateSnowflakeConnectorOptions {
  readonly client: SnowflakeProviderClient;
  readonly config: SnowflakeConfig;
  readonly continuationStore?: ContinuationStore;
  readonly queryGate?: QueryConcurrencyGate;
}

function invalidInput(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function resolveColumnsForRead(
  config: SnowflakeConfig,
  schema: string,
  table: string,
  requested: readonly string[] | undefined,
): readonly string[] {
  const configured = resolveAllowedColumnsForTable(
    schema,
    table,
    config.allowedColumns,
  );
  if (requested !== undefined) {
    assertColumnsAllowed(schema, table, requested, config.allowedColumns);
    return requested;
  }
  if (configured !== undefined) {
    if (configured.length === 0) {
      throw new ConnectorSdkError(
        "FORBIDDEN",
        "No columns are allowed for this table.",
      );
    }
    return configured;
  }
  throw new ConnectorSdkError(
    "FORBIDDEN",
    "Column projection requires an allowlist or explicit columns.",
  );
}

function filterSchemasByPolicy(
  schemaNames: readonly string[],
  allowedSchemas: readonly string[] | undefined,
): string[] {
  if (allowedSchemas === undefined) {
    return [...schemaNames];
  }
  const allow = new Set(allowedSchemas);
  return schemaNames.filter((name) => allow.has(name));
}

function filterTablesByPolicy(
  tables: readonly string[],
  schema: string,
  allowedTables: SnowflakeConfig["allowedTables"],
): string[] {
  if (allowedTables === undefined) {
    return [...tables];
  }
  const allowed = allowedTables[schema];
  if (allowed === undefined) {
    return [];
  }
  const allowSet = new Set(allowed);
  return tables.filter((name) => allowSet.has(name));
}

export function createSnowflakeConnector(
  options: CreateSnowflakeConnectorOptions,
): DefinedConnector {
  const { client, config } = options;
  const continuations = options.continuationStore ?? new ContinuationStore();
  const queryGate = options.queryGate ?? new QueryConcurrencyGate();

  const timeoutMs = config.queryTimeoutSeconds * 1000;

  async function runQuery(
    sqlText: string,
    binds: readonly (string | number | boolean | null)[],
    maxRows: number,
    signal?: AbortSignal,
  ) {
    return queryGate.run(() =>
      client.execute({
        sqlText,
        binds,
        timeoutMs,
        maxRows,
        signal,
      }),
    );
  }

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Snowflake read-only MCP connector: bounded catalog discovery, column-allowlisted row samples, and structured aggregations with server-built SELECT statements.",
    tools: [
      defineTool({
        name: SNOWFLAKE_DATABASE_GET_TOOL,
        description:
          "Returns the configured Snowflake database context (account, role, warehouse, database).",
        inputSchema: databaseGetInputJsonSchema,
        handler: async (input) => {
          const parsed = databaseGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          const output = {
            account: config.account,
            role: config.role,
            warehouse: config.warehouse,
            database: config.database,
          };
          assertStructuredOutputWithinBudget(output);
          return output;
        },
      }),
      defineTool({
        name: SNOWFLAKE_SCHEMA_LIST_TOOL,
        description:
          "Lists schemas in the configured database (optional schema allowlist).",
        inputSchema: schemaListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = schemaListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          const limit = defaultListPageSize(
            parsed.data.limit,
            LIST_DEFAULT_PAGE_SIZE,
          );
          const scope = {
            connectorKey: CONNECTOR_KEY,
            family: "schema.list" as const,
            pageSize: limit,
          };
          const offset = parseProviderOffset(
            parsed.data.continuationToken !== undefined
              ? continuations.resolve(parsed.data.continuationToken, scope)
              : undefined,
          );
          try {
            const built = buildSchemaListQuery(
              config.database,
              limit + 1,
              offset,
            );
            const result = await runQuery(
              built.sqlText,
              built.binds,
              limit + 1,
              context.signal,
            );
            let names = result.rows
              .map((row) => row.SCHEMA_NAME)
              .filter((v): v is string => typeof v === "string");
            names = filterSchemasByPolicy(names, config.allowedSchemas);
            const hasMore = names.length > limit || result.rows.length > limit;
            const page = names.slice(0, limit);
            let continuationToken: string | undefined;
            if (hasMore) {
              continuationToken = continuations.issue(
                scope,
                String(offset + limit),
              );
            }
            const output = mapListResponse(
              page.map((schema) => ({ schema })),
              continuationToken,
            );
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapSnowflakeError(error, { password: config.password });
          }
        },
      }),
      defineTool({
        name: SNOWFLAKE_SCHEMA_GET_TOOL,
        description: "Fetches metadata for a single schema.",
        inputSchema: schemaGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = schemaGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          assertSchemaAllowed(parsed.data.schema, config.allowedSchemas);
          try {
            const built = buildSchemaGetSql(
              config.database,
              parsed.data.schema,
            );
            const result = await runQuery(
              built.sqlText,
              built.binds,
              1,
              context.signal,
            );
            const row = result.rows[0];
            if (row === undefined) {
              throw new ConnectorSdkError("NOT_FOUND", "Schema was not found.");
            }
            const output = {
              schema: String(row.SCHEMA_NAME ?? parsed.data.schema),
              owner:
                row.SCHEMA_OWNER !== undefined && row.SCHEMA_OWNER !== null
                  ? String(row.SCHEMA_OWNER)
                  : undefined,
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapSnowflakeError(error, { password: config.password });
          }
        },
      }),
      defineTool({
        name: SNOWFLAKE_TABLE_LIST_TOOL,
        description: "Lists tables for a schema.",
        inputSchema: tableListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          assertSchemaAllowed(parsed.data.schema, config.allowedSchemas);
          const limit = defaultListPageSize(
            parsed.data.limit,
            LIST_DEFAULT_PAGE_SIZE,
          );
          const scope = {
            connectorKey: CONNECTOR_KEY,
            family: "table.list" as const,
            schema: parsed.data.schema,
            pageSize: limit,
          };
          const offset = parseProviderOffset(
            parsed.data.continuationToken !== undefined
              ? continuations.resolve(parsed.data.continuationToken, scope)
              : undefined,
          );
          try {
            const built = buildTableListSql(
              config.database,
              parsed.data.schema,
              limit + 1,
              offset,
            );
            const result = await runQuery(
              built.sqlText,
              built.binds,
              limit + 1,
              context.signal,
            );
            let names = result.rows
              .map((row) => row.TABLE_NAME)
              .filter((v): v is string => typeof v === "string");
            names = filterTablesByPolicy(
              names,
              parsed.data.schema,
              config.allowedTables,
            );
            const page = names.slice(0, limit);
            const hasMore = names.length > limit;
            let continuationToken: string | undefined;
            if (hasMore) {
              continuationToken = continuations.issue(
                scope,
                String(offset + limit),
              );
            }
            const output = mapListResponse(
              page.map((table) => ({ table })),
              continuationToken,
            );
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapSnowflakeError(error, { password: config.password });
          }
        },
      }),
      defineTool({
        name: SNOWFLAKE_TABLE_GET_TOOL,
        description: "Fetches metadata for a single table.",
        inputSchema: tableGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          assertSchemaAllowed(parsed.data.schema, config.allowedSchemas);
          assertTableAllowed(
            parsed.data.schema,
            parsed.data.table,
            config.allowedTables,
          );
          try {
            const built = buildTableGetSql(
              config.database,
              parsed.data.schema,
              parsed.data.table,
            );
            const result = await runQuery(
              built.sqlText,
              built.binds,
              1,
              context.signal,
            );
            const row = result.rows[0];
            if (row === undefined) {
              throw new ConnectorSdkError("NOT_FOUND", "Table was not found.");
            }
            const output = {
              schema: parsed.data.schema,
              table: String(row.TABLE_NAME ?? parsed.data.table),
              tableType:
                row.TABLE_TYPE !== undefined && row.TABLE_TYPE !== null
                  ? String(row.TABLE_TYPE)
                  : undefined,
              rowCount:
                row.ROW_COUNT !== undefined && row.ROW_COUNT !== null
                  ? Number(row.ROW_COUNT)
                  : undefined,
              bytes:
                row.BYTES !== undefined && row.BYTES !== null
                  ? Number(row.BYTES)
                  : undefined,
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapSnowflakeError(error, { password: config.password });
          }
        },
      }),
      defineTool({
        name: SNOWFLAKE_TABLE_COLUMNS_LIST_TOOL,
        description: "Lists columns for an allowlisted table.",
        inputSchema: columnsListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = columnsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          assertSchemaAllowed(parsed.data.schema, config.allowedSchemas);
          assertTableAllowed(
            parsed.data.schema,
            parsed.data.table,
            config.allowedTables,
          );
          const limit = defaultListPageSize(
            parsed.data.limit,
            LIST_DEFAULT_PAGE_SIZE,
          );
          const scope = {
            connectorKey: CONNECTOR_KEY,
            family: "table.columns.list" as const,
            schema: parsed.data.schema,
            table: parsed.data.table,
            pageSize: limit,
          };
          const offset = parseProviderOffset(
            parsed.data.continuationToken !== undefined
              ? continuations.resolve(parsed.data.continuationToken, scope)
              : undefined,
          );
          try {
            const built = buildColumnsListSql(
              config.database,
              parsed.data.schema,
              parsed.data.table,
              limit + 1,
              offset,
            );
            const result = await runQuery(
              built.sqlText,
              built.binds,
              limit + 1,
              context.signal,
            );
            const allowed = resolveAllowedColumnsForTable(
              parsed.data.schema,
              parsed.data.table,
              config.allowedColumns,
            );
            let rows = result.rows.map((row) => ({
              column: String(row.COLUMN_NAME ?? ""),
              dataType:
                row.DATA_TYPE !== undefined && row.DATA_TYPE !== null
                  ? String(row.DATA_TYPE)
                  : undefined,
              nullable:
                row.IS_NULLABLE !== undefined
                  ? String(row.IS_NULLABLE).toUpperCase() === "YES"
                  : undefined,
              ordinalPosition:
                row.ORDINAL_POSITION !== undefined
                  ? Number(row.ORDINAL_POSITION)
                  : undefined,
            }));
            if (allowed !== undefined) {
              const allowSet = new Set(allowed);
              rows = rows.filter((row) => allowSet.has(row.column));
            }
            const page = rows.slice(0, limit);
            let continuationToken: string | undefined;
            if (rows.length > limit || result.rows.length > limit) {
              continuationToken = continuations.issue(
                scope,
                String(offset + limit),
              );
            }
            const output = mapListResponse(page, continuationToken);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapSnowflakeError(error, { password: config.password });
          }
        },
      }),
      defineTool({
        name: SNOWFLAKE_TABLE_ROWS_SAMPLE_TOOL,
        description:
          "Returns a bounded row sample using server-built parameterized SELECT and structured filters.",
        inputSchema: rowsSampleInputJsonSchema,
        handler: async (input, context) => {
          const parsed = rowsSampleInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          assertSchemaAllowed(parsed.data.schema, config.allowedSchemas);
          assertTableAllowed(
            parsed.data.schema,
            parsed.data.table,
            config.allowedTables,
          );
          const columns = resolveColumnsForRead(
            config,
            parsed.data.schema,
            parsed.data.table,
            parsed.data.columns,
          );
          const filters = normalizeFilters(
            parsed.data.filters as StructuredFilter[] | undefined,
          );
          for (const filter of filters) {
            assertColumnAllowed(
              parsed.data.schema,
              parsed.data.table,
              filter.column,
              config.allowedColumns,
            );
          }
          if (parsed.data.orderBy !== undefined) {
            for (const entry of parsed.data.orderBy) {
              assertColumnAllowed(
                parsed.data.schema,
                parsed.data.table,
                entry.column,
                config.allowedColumns,
              );
            }
          }
          const limit = defaultSampleRowLimit(parsed.data.limit);
          const scope = {
            connectorKey: CONNECTOR_KEY,
            family: "table.rows.sample" as const,
            schema: parsed.data.schema,
            table: parsed.data.table,
            pageSize: limit,
          };
          const offset = parseProviderOffset(
            parsed.data.continuationToken !== undefined
              ? continuations.resolve(parsed.data.continuationToken, scope)
              : undefined,
          );
          try {
            const built = buildSampleSelectQuery({
              database: config.database,
              schema: parsed.data.schema,
              table: parsed.data.table,
              columns,
              filters,
              orderBy: parsed.data.orderBy,
              limit: limit + 1,
              offset,
            });
            const result = await runQuery(
              built.sqlText,
              built.binds,
              limit + 1,
              context.signal,
            );
            const page = result.rows.slice(0, limit);
            const hasMore = result.rows.length > limit;
            let continuationToken: string | undefined;
            if (hasMore) {
              continuationToken = continuations.issue(
                scope,
                String(offset + limit),
              );
            }
            const output = {
              columns: result.columns.map((c) => c.name),
              rows: page,
              rowCount: page.length,
              truncated: hasMore,
              continuationToken,
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapSnowflakeError(error, { password: config.password });
          }
        },
      }),
      defineTool({
        name: SNOWFLAKE_TABLE_AGGREGATE_TOOL,
        description:
          "Runs a structured aggregation (max two GROUP BY columns) with server-built SELECT.",
        inputSchema: tableAggregateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableAggregateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInput();
          }
          assertSchemaAllowed(parsed.data.schema, config.allowedSchemas);
          assertTableAllowed(
            parsed.data.schema,
            parsed.data.table,
            config.allowedTables,
          );
          const metrics = normalizeAggregateMetrics(parsed.data.metrics);
          const groupBy = normalizeGroupBy(parsed.data.groupBy);
          const filters = normalizeFilters(
            parsed.data.filters as StructuredFilter[] | undefined,
          );
          for (const filter of filters) {
            assertColumnAllowed(
              parsed.data.schema,
              parsed.data.table,
              filter.column,
              config.allowedColumns,
            );
          }
          for (const col of groupBy) {
            assertColumnAllowed(
              parsed.data.schema,
              parsed.data.table,
              col,
              config.allowedColumns,
            );
          }
          for (const metric of metrics) {
            if (metric.column !== undefined) {
              assertColumnAllowed(
                parsed.data.schema,
                parsed.data.table,
                metric.column,
                config.allowedColumns,
              );
            }
          }
          const limit = defaultSampleRowLimit(parsed.data.limit);
          try {
            const built = buildAggregateSelectQuery({
              database: config.database,
              schema: parsed.data.schema,
              table: parsed.data.table,
              metrics,
              groupBy,
              filters,
              limit,
            });
            const result = await runQuery(
              built.sqlText,
              built.binds,
              limit,
              context.signal,
            );
            const output = {
              rows: result.rows,
              rowCount: result.rowCount,
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapSnowflakeError(error, { password: config.password });
          }
        },
      }),
    ],
  });
}
