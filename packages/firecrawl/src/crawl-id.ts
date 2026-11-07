import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_CRAWL_ID_LENGTH, UUID_PATTERN } from "./constants.js";

export function parseCrawlId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CRAWL_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", "Crawl job ID is not valid.");
  }
  if (!UUID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", "Crawl job ID is not valid.");
  }
  return trimmed.toLowerCase();
}
