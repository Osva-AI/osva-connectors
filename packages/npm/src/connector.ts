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
  NPM_DOWNLOADS_TOOL,
  NPM_PACKAGE_METADATA_TOOL,
} from "./constants.js";
import { createNpmClient, type NpmClient } from "./npm-client.js";
import { parseDownloadsInput, parsePackageMetadataInput } from "./schemas.js";
import {
  downloadsInputJsonSchema,
  packageMetadataInputJsonSchema,
} from "./tool-schemas.js";

export interface CreateNpmConnectorOptions {
  readonly client?: NpmClient;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

export function createNpmConnector(
  options: CreateNpmConnectorOptions = {},
): DefinedConnector {
  const client =
    options.client ??
    createNpmClient({
      ...(options.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : {}),
      ...(options.userAgent !== undefined
        ? { userAgent: options.userAgent }
        : {}),
    });

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Read-only npm registry and download metadata connector for OSVA Connector Profile V1. Outbound HTTPS is restricted to official npm registry and downloads hosts.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: NPM_PACKAGE_METADATA_TOOL,
        description:
          "Fetch normalized metadata for an npm package from the public registry.",
        inputSchema: packageMetadataInputJsonSchema,
        handler: async (input, context) => {
          let parsed;
          try {
            parsed = parsePackageMetadataInput(input);
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          return client.fetchPackageMetadata(parsed.packageName, {
            signal: context.signal,
          });
        },
      }),
      defineTool({
        name: NPM_DOWNLOADS_TOOL,
        description:
          "Fetch normalized download counts for an npm package for the last-month period.",
        inputSchema: downloadsInputJsonSchema,
        handler: async (input, context) => {
          let parsed;
          try {
            parsed = parseDownloadsInput(input);
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          return client.fetchDownloads(parsed.packageName, parsed.period, {
            signal: context.signal,
          });
        },
      }),
    ],
  });
}
