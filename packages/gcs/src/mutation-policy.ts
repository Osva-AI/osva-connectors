import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { GcsConfig } from "./schemas.js";

export function assertCreateAllowed(config: GcsConfig): void {
  if (!config.createEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "GCS object creates are disabled. Set OSVA_CONNECTOR_GCS_CREATE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "GCS writes require host approval. Set OSVA_CONNECTOR_GCS_HOST_WRITES_APPROVED=true.",
    );
  }
}

export function assertReplaceAllowed(config: GcsConfig): void {
  if (!config.replaceEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "GCS object replaces are disabled. Set OSVA_CONNECTOR_GCS_REPLACE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "GCS writes require host approval. Set OSVA_CONNECTOR_GCS_HOST_WRITES_APPROVED=true.",
    );
  }
}
