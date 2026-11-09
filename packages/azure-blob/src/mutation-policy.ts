import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { AzureBlobConfig } from "./schemas.js";

export function assertCreateAllowed(config: AzureBlobConfig): void {
  if (!config.createEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Azure Blob object creates are disabled. Set OSVA_CONNECTOR_AZURE_BLOB_CREATE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Azure Blob writes require host approval. Set OSVA_CONNECTOR_AZURE_BLOB_HOST_WRITES_APPROVED=true.",
    );
  }
}

export function assertReplaceAllowed(config: AzureBlobConfig): void {
  if (!config.replaceEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Azure Blob object replaces are disabled. Set OSVA_CONNECTOR_AZURE_BLOB_REPLACE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Azure Blob writes require host approval. Set OSVA_CONNECTOR_AZURE_BLOB_HOST_WRITES_APPROVED=true.",
    );
  }
}
