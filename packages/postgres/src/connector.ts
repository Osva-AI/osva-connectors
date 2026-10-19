import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTION_TEST_SQL,
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  POSTGRES_COLUMN_LIST_TOOL,
  POSTGRES_CONNECTION_TEST_TOOL,
  POSTGRES_QUERY_READ_TOOL,
  POSTGRES_SCHEMA_LIST_TOOL,
  POSTGRES_TABLE_LIST_TOOL,
} from "./constants.js";
import {
  queryReadInputJsonSchema,
  queryReadInputSchema,
} from "./query-read-schemas.js";
import { runQueryRead } from "./query-read/run-query-read.js";
import { QUERY_READ_DEFAULT_LOCK_TIMEOUT_MS } from "./query-read/constants.js";
import {
  columnListInputJsonSchema,
  columnListInputSchema,
  schemaListInputJsonSchema,
  schemaListInputSchema,
  tableListInputJsonSchema,
  tableListInputSchema,
} from "./discovery-schemas.js";
import {
  runColumnList,
  runSchemaList,
  runTableList,
} from "./discovery/run-discovery.js";
import { mapPostgresError } from "./map-postgres-error.js";
import type { PostgresDatabase } from "./postgres-client.js";
import {
  connectionTestInputJsonSchema,
  connectionTestInputSchema,
  connectionTestOutputSchema,
} from "./schemas.js";

export interface CreatePostgresConnectorOptions {
  readonly database: PostgresDatabase;
  readonly allowedSchemas?: readonly string[];
  readonly queryTimeoutMs: number;
  readonly lockTimeoutMs?: number;
}

export function createPostgresConnector(
  options: CreatePostgresConnectorOptions,
): DefinedConnector {
  const allowedSchemas = options.allowedSchemas;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "PostgreSQL read-only connector for OSVA Connector Profile V1 (connection test, catalog discovery, and bounded parameterized SELECT queries). Database grants and RLS remain the primary authorization layers.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: POSTGRES_CONNECTION_TEST_TOOL,
        description:
          "Validates PostgreSQL connectivity using a fixed, parameter-free health query. Returns safe diagnostics only (no credentials or connection URLs).",
        inputSchema: connectionTestInputJsonSchema,
        handler: async (input, context) => {
          const parsed = connectionTestInputSchema.safeParse(input);
          if (!parsed.success) {
            throw new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
          }

          try {
            const result = await options.database.query(
              CONNECTION_TEST_SQL,
              [],
              {
                signal: context.signal,
              },
            );
            const row = result.rows[0];
            const rawVersion = row?.["server_version"];
            const serverVersion =
              typeof rawVersion === "string" && rawVersion.length > 0
                ? rawVersion
                : "unknown";

            const output = connectionTestOutputSchema.parse({
              ok: true,
              serverVersion,
            });
            return output;
          } catch (error) {
            throw mapPostgresError(error);
          }
        },
      }),
      defineTool({
        name: POSTGRES_SCHEMA_LIST_TOOL,
        description:
          "Lists accessible non-system schemas visible to the connected role (read-only, fixed catalog SQL). Results are paginated and bounded.",
        inputSchema: schemaListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = schemaListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
          }
          try {
            return await runSchemaList(parsed.data, {
              database: options.database,
              allowedSchemas,
              signal: context.signal,
            });
          } catch (error) {
            throw mapPostgresError(error);
          }
        },
      }),
      defineTool({
        name: POSTGRES_TABLE_LIST_TOOL,
        description:
          "Lists tables, views, and materialized views in a schema when the role has USAGE on the schema and SELECT on the relation (read-only, fixed catalog SQL).",
        inputSchema: tableListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = tableListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
          }
          try {
            return await runTableList(parsed.data, {
              database: options.database,
              allowedSchemas,
              signal: context.signal,
            });
          } catch (error) {
            throw mapPostgresError(error);
          }
        },
      }),
      defineTool({
        name: POSTGRES_COLUMN_LIST_TOOL,
        description:
          "Lists columns for a table or view when the role has SELECT privilege (read-only, fixed catalog SQL). Does not return defaults, comments, or expressions.",
        inputSchema: columnListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = columnListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
          }
          try {
            return await runColumnList(parsed.data, {
              database: options.database,
              allowedSchemas,
              signal: context.signal,
            });
          } catch (error) {
            throw mapPostgresError(error);
          }
        },
      }),
      defineTool({
        name: POSTGRES_QUERY_READ_TOOL,
        description:
          "Executes a single parameterized read-only SELECT in a READ ONLY transaction with bounded rows and output size. SQL admission is defense in depth; database privileges and RLS remain authoritative.",
        inputSchema: queryReadInputJsonSchema,
        handler: async (input, context) => {
          const parsed = queryReadInputSchema.safeParse(input);
          if (!parsed.success) {
            throw new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
          }
          try {
            return await runQueryRead({
              database: options.database,
              input: parsed.data,
              signal: context.signal,
              statementTimeoutMs: options.queryTimeoutMs,
              lockTimeoutMs:
                options.lockTimeoutMs ?? QUERY_READ_DEFAULT_LOCK_TIMEOUT_MS,
            });
          } catch (error) {
            throw mapPostgresError(error);
          }
        },
      }),
    ],
  });
}
