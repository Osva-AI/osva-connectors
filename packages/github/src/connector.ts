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
  GITHUB_REPOSITORY_GET_TOOL,
} from "./constants.js";
import type { GithubRepositoryClient } from "./github-client.js";
import { mapGithubError } from "./map-github-error.js";
import { mapRepositoryRecord } from "./map-repository.js";
import {
  repositoryGetInputJsonSchema,
  repositoryGetInputSchema,
} from "./schemas.js";

export interface CreateGithubConnectorOptions {
  readonly client: GithubRepositoryClient;
}

export function createGithubConnector(
  options: CreateGithubConnectorOptions,
): DefinedConnector {
  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Read-only GitHub connector for OSVA Connector Profile V1. Tool authorization is enforced by OSVA ToolPolicy; GitHub credentials control provider-side repository access.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: GITHUB_REPOSITORY_GET_TOOL,
        description:
          "Returns basic metadata for a GitHub repository (read-only).",
        inputSchema: repositoryGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = repositoryGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw new ConnectorSdkError(
              "INVALID_INPUT",
              "Invalid owner or repository name.",
            );
          }

          try {
            const record = await options.client.getRepository({
              owner: parsed.data.owner,
              repo: parsed.data.repo,
              signal: context.signal,
            });
            return mapRepositoryRecord(record);
          } catch (error) {
            throw mapGithubError(error);
          }
        },
      }),
    ],
  });
}
