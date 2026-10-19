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
  POSTGRES_CONNECTION_TEST_TOOL,
} from "./constants.js";
import { mapPostgresError } from "./map-postgres-error.js";
import type { PostgresDatabase } from "./postgres-client.js";
import {
  connectionTestInputJsonSchema,
  connectionTestInputSchema,
  connectionTestOutputSchema,
} from "./schemas.js";

export interface CreatePostgresConnectorOptions {
  readonly database: PostgresDatabase;
}

export function createPostgresConnector(
  options: CreatePostgresConnectorOptions,
): DefinedConnector {
  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "PostgreSQL connector foundation for OSVA Connector Profile V1 (connection health check only in P0.1). Database privileges and OSVA ToolPolicy remain the primary authorization layers; arbitrary SQL execution is not supported in this milestone.",
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
            const result = await options.database.query(CONNECTION_TEST_SQL, {
              signal: context.signal,
            });
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
    ],
  });
}
