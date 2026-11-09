import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { S3Config } from "./schemas.js";

export function assertCreateAllowed(config: S3Config): void {
  if (!config.createEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "S3 object creates are disabled. Set OSVA_CONNECTOR_S3_CREATE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "S3 writes require host approval. Set OSVA_CONNECTOR_S3_HOST_WRITES_APPROVED=true.",
    );
  }
}

export function assertReplaceAllowed(config: S3Config): void {
  if (!config.replaceEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "S3 object replaces are disabled. Set OSVA_CONNECTOR_S3_REPLACE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "S3 writes require host approval. Set OSVA_CONNECTOR_S3_HOST_WRITES_APPROVED=true.",
    );
  }
}
