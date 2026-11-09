import {
  ConnectorSdkError,
  defineConnector,
  defineTool,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_DEFAULT_PAGE_SIZE,
  SUPABASE_PROJECT_GET_TOOL,
  SUPABASE_SCHEMA_LIST_TOOL,
  SUPABASE_TABLE_COLUMNS_LIST_TOOL,
  SUPABASE_TABLE_GET_TOOL,
  SUPABASE_TABLE_LIST_TOOL,
  SUPABASE_TABLE_ROW_GET_TOOL,
  SUPABASE_TABLE_ROWS_COUNT_TOOL,
  SUPABASE_TABLE_ROWS_LIST_TOOL,
} from "./constants.js";
import { findCatalogTable } from "./openapi-catalog.js";
import { ContinuationStore } from "./continuation-store.js";
import { mapSupabaseError } from "./map-supabase-error.js";
import {
  assertStructuredOutputWithinBudget,
  pickAllowlistedRowFields,
} from "./output-budget.js";
import type { SupabaseProviderClient } from "./provider-client.js";
import {
  assertColumnsSubset,
  assertSchemaAllowed,
  resolveTableScope,
  tableAllowedForDiscovery,
} from "./resource-scope.js";
import type { SupabaseConfig } from "./schemas.js";
import {
  projectGetInputJsonSchema,
  projectGetInputSchema,
  schemaListInputJsonSchema,
  schemaListInputSchema,
  tableColumnsListInputJsonSchema,
  tableColumnsListInputSchema,
  tableGetInputJsonSchema,
  tableGetInputSchema,
  tableListInputJsonSchema,
  tableListInputSchema,
  tableRowGetInputJsonSchema,
  tableRowGetInputSchema,
  tableRowsCountInputJsonSchema,
  tableRowsCountInputSchema,
  tableRowsListInputJsonSchema,
  tableRowsListInputSchema,
} from "./tool-schemas.js";

export interface CreateSupabaseConnectorOptions {
  readonly client: SupabaseProviderClient;
  readonly config: SupabaseConfig;
  readonly continuationStore?: ContinuationStore;
  readonly credentialsForRedaction?: {
    readonly publishableKey: string;
    readonly userAccessToken: string;
  };
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  options: CreateSupabaseConnectorOptions,
): ConnectorSdkError {
  return mapSupabaseError(error, options.credentialsForRedaction);
}

function scopeFingerprint(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function createSupabaseConnector(
  options: CreateSupabaseConnectorOptions,
): DefinedConnector {
  const { client, config } = options;
  const continuations = options.continuationStore ?? new ContinuationStore();

  async function loadCatalog(signal?: AbortSignal) {
    return client.getOpenApiCatalog(signal);
  }

  function filterCatalogTables(
    catalog: Awaited<ReturnType<typeof loadCatalog>>,
    schema?: string,
  ) {
    return catalog.tables.filter((table) => {
      if (schema !== undefined && table.schema !== schema) {
        return false;
      }
      try {
        assertSchemaAllowed(config.allowedSchemas, table.schema);
      } catch {
        return false;
      }
      return tableAllowedForDiscovery(
        config.allowedTables,
        table.schema,
        table.name,
      );
    });
  }

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Supabase PostgREST MCP connector (read-only): project metadata, schema and table discovery, bounded row reads, single-row lookup, and gated exact counts. Uses publishable key plus user JWT; rejects service_role credentials. Column and table allowlists are host-controlled.",
    tools: [
      defineTool({
        name: SUPABASE_PROJECT_GET_TOOL,
        description:
          "Returns non-secret Supabase project metadata (project ref, REST base URL, configured allowlists).",
        inputSchema: projectGetInputJsonSchema,
        handler: async (input) => {
          const parsed = projectGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const output = {
            project: {
              projectRef: config.projectRef,
              restBaseUrl: config.restBaseUrl,
              pinnedOrigin: config.pinnedOrigin,
              allowedSchemas: config.allowedSchemas,
              allowedTableCount:
                config.allowedTables === undefined
                  ? undefined
                  : Object.values(config.allowedTables).reduce(
                      (sum, tables) => sum + Object.keys(tables).length,
                      0,
                    ),
              countExactEnabled: config.countExactEnabled,
            },
          };
          assertStructuredOutputWithinBudget(output);
          return output;
        },
      }),
      defineTool({
        name: SUPABASE_SCHEMA_LIST_TOOL,
        description:
          "Lists database schemas exposed via PostgREST OpenAPI, filtered by OSVA_CONNECTOR_SUPABASE_ALLOWED_SCHEMAS and ALLOWED_TABLES when set.",
        inputSchema: schemaListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = schemaListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const catalog = await loadCatalog(context.signal);
            const schemas = [
              ...new Set(
                filterCatalogTables(catalog).map((table) => table.schema),
              ),
            ].toSorted();
            const output = { schemas };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SUPABASE_TABLE_LIST_TOOL,
        description:
          "Lists PostgREST-exposed tables for an optional schema, respecting allowlists.",
        inputSchema: tableListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          if (parsed.data.schema !== undefined) {
            assertSchemaAllowed(config.allowedSchemas, parsed.data.schema);
          }
          try {
            const catalog = await loadCatalog(context.signal);
            const tables = filterCatalogTables(catalog, parsed.data.schema).map(
              (table) => ({
                schema: table.schema,
                name: table.name,
                columnCount: table.columns.length,
              }),
            );
            const output = { tables };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SUPABASE_TABLE_GET_TOOL,
        description: "Returns OpenAPI-derived metadata for a single table.",
        inputSchema: tableGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertSchemaAllowed(config.allowedSchemas, parsed.data.schema);
          if (
            !tableAllowedForDiscovery(
              config.allowedTables,
              parsed.data.schema,
              parsed.data.table,
            )
          ) {
            throw new ConnectorSdkError("FORBIDDEN", "Table is not allowed.");
          }
          try {
            const catalog = await loadCatalog(context.signal);
            const table = findCatalogTable(
              catalog,
              parsed.data.schema,
              parsed.data.table,
            );
            if (table === undefined) {
              throw new ConnectorSdkError("NOT_FOUND", "Table was not found.");
            }
            const output = {
              table: {
                schema: table.schema,
                name: table.name,
                columnCount: table.columns.length,
              },
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SUPABASE_TABLE_COLUMNS_LIST_TOOL,
        description:
          "Lists columns for a table from PostgREST OpenAPI (name, data type, required).",
        inputSchema: tableColumnsListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableColumnsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertSchemaAllowed(config.allowedSchemas, parsed.data.schema);
          if (
            !tableAllowedForDiscovery(
              config.allowedTables,
              parsed.data.schema,
              parsed.data.table,
            )
          ) {
            throw new ConnectorSdkError("FORBIDDEN", "Table is not allowed.");
          }
          try {
            const catalog = await loadCatalog(context.signal);
            const table = findCatalogTable(
              catalog,
              parsed.data.schema,
              parsed.data.table,
            );
            if (table === undefined) {
              throw new ConnectorSdkError("NOT_FOUND", "Table was not found.");
            }
            const output = { columns: table.columns };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SUPABASE_TABLE_ROWS_LIST_TOOL,
        description:
          "Lists rows from an allowlisted table with explicit column projection, structured PostgREST filters, and continuation tokens (no select=*).",
        inputSchema: tableRowsListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableRowsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const scope = resolveTableScope(
            config.allowedTables,
            parsed.data.schema,
            parsed.data.table,
          );
          assertSchemaAllowed(config.allowedSchemas, parsed.data.schema);
          const selectedColumns = assertColumnsSubset(
            scope,
            parsed.data.columns,
          );
          const limit = parsed.data.limit ?? LIST_DEFAULT_PAGE_SIZE;
          const filters = parsed.data.filters;
          const order = parsed.data.order;
          if (order !== undefined && !scope.columns.includes(order.column)) {
            throw new ConnectorSdkError(
              "FORBIDDEN",
              "Order column is not allowlisted.",
            );
          }
          const filterFingerprint = scopeFingerprint(filters);
          const orderFingerprint = scopeFingerprint(order);
          const continuationScope = {
            connectorKey: CONNECTOR_KEY,
            family: "table.rows.list" as const,
            schema: parsed.data.schema,
            table: parsed.data.table,
            pageSize: limit,
            filterFingerprint,
            orderFingerprint,
          };
          let offset = 0;
          if (parsed.data.continuationToken !== undefined) {
            offset = continuations.resolve(
              parsed.data.continuationToken,
              continuationScope,
            );
          }
          try {
            const result = await client.selectRows({
              schema: parsed.data.schema,
              table: parsed.data.table,
              columns: selectedColumns,
              filterAllowColumns: scope.columns,
              limit,
              offset,
              ...(filters !== undefined ? { filters } : {}),
              ...(order !== undefined
                ? {
                    orderColumn: order.column,
                    orderAscending: order.ascending,
                  }
                : {}),
              signal: context.signal,
            });
            const rows = result.rows.map((row) =>
              pickAllowlistedRowFields(row, selectedColumns),
            );
            let continuationToken: string | undefined;
            const end = result.rangeEnd ?? offset + rows.length - 1;
            const total = result.total;
            const hasMore =
              total !== undefined ? end + 1 < total : rows.length >= limit;
            if (hasMore) {
              continuationToken = continuations.issue(
                continuationScope,
                end + 1,
              );
            }
            const output = {
              rows,
              pageInfo: {
                limit,
                offset,
                hasMore,
                ...(continuationToken !== undefined
                  ? { continuationToken }
                  : {}),
                ...(total !== undefined ? { total } : {}),
              },
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SUPABASE_TABLE_ROW_GET_TOOL,
        description:
          "Fetches a single row by configured lookupColumn (from ALLOWED_TABLES) and lookupValue.",
        inputSchema: tableRowGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableRowGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const scope = resolveTableScope(
            config.allowedTables,
            parsed.data.schema,
            parsed.data.table,
          );
          const lookupColumn = scope.lookupColumn;
          if (lookupColumn === undefined) {
            throw new ConnectorSdkError(
              "CONFIGURATION_ERROR",
              "Table row get requires lookupColumn in ALLOWED_TABLES.",
            );
          }
          const selectedColumns = assertColumnsSubset(
            scope,
            parsed.data.columns,
          );
          try {
            const result = await client.selectRows({
              schema: parsed.data.schema,
              table: parsed.data.table,
              columns: selectedColumns,
              filterAllowColumns: scope.columns,
              limit: 1,
              offset: 0,
              filters: [
                {
                  column: lookupColumn,
                  operator: "eq",
                  value: parsed.data.lookupValue,
                },
              ],
              signal: context.signal,
            });
            const row = result.rows[0];
            if (row === undefined) {
              throw new ConnectorSdkError("NOT_FOUND", "Row was not found.");
            }
            const output = {
              row: pickAllowlistedRowFields(row, selectedColumns),
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SUPABASE_TABLE_ROWS_COUNT_TOOL,
        description:
          "Counts rows with structured filters. Exact counts (Prefer count=exact) require OSVA_CONNECTOR_SUPABASE_COUNT_EXACT_ENABLED=true.",
        inputSchema: tableRowsCountInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableRowsCountInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const scope = resolveTableScope(
            config.allowedTables,
            parsed.data.schema,
            parsed.data.table,
          );
          const filters = parsed.data.filters;
          if (filters !== undefined) {
            for (const filter of filters) {
              if (!scope.columns.includes(filter.column)) {
                throw new ConnectorSdkError(
                  "FORBIDDEN",
                  "Filter column is not allowlisted.",
                );
              }
            }
          }
          const exact = parsed.data.exact === true;
          if (exact && !config.countExactEnabled) {
            throw new ConnectorSdkError(
              "FORBIDDEN",
              "Exact row counts are disabled. Set OSVA_CONNECTOR_SUPABASE_COUNT_EXACT_ENABLED=true.",
            );
          }
          try {
            const count = await client.countRows({
              schema: parsed.data.schema,
              table: parsed.data.table,
              ...(filters !== undefined ? { filters } : {}),
              exact,
              signal: context.signal,
            });
            const output = { count, exact };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
    ],
  });
}
