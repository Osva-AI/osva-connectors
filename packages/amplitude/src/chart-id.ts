import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_CHART_ID_LENGTH } from "./constants.js";

const CHART_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function parseChartId(value: string, label = "Chart ID"): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CHART_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is invalid.`);
  }
  if (!CHART_ID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is invalid.`);
  }
  return trimmed;
}
