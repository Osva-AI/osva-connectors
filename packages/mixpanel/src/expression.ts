import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_EXPRESSION_LENGTH } from "./constants.js";

export function validateMixpanelExpression(
  value: string,
  label: "where" | "on",
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EXPRESSION_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `Mixpanel ${label} expression is invalid.`,
    );
  }
  if (/[\n\r]/.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `Mixpanel ${label} expression must not contain newlines.`,
    );
  }
  return trimmed;
}
