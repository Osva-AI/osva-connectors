import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_ACCOUNT_ID_DIGITS } from "./constants.js";

const ACT_PREFIX = "act_";
const NUMERIC_ACCOUNT_PATTERN = /^\d{1,20}$/;

export function normalizeAccountIdInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Ad account ID is required.");
  }
  if (
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes(":") ||
    trimmed.toLowerCase().startsWith("http")
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Ad account ID must be a numeric identifier, not a URL.",
    );
  }

  let digits: string;
  if (trimmed.toLowerCase().startsWith(ACT_PREFIX)) {
    digits = trimmed.slice(ACT_PREFIX.length);
  } else {
    digits = trimmed;
  }

  if (!NUMERIC_ACCOUNT_PATTERN.test(digits)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Ad account ID must be numeric (optionally prefixed with act_).",
    );
  }
  if (digits.length > MAX_ACCOUNT_ID_DIGITS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Ad account ID exceeds supported length.",
    );
  }

  return `${ACT_PREFIX}${digits}`;
}

export function accountIdToApiPath(accountId: string): string {
  return normalizeAccountIdInput(accountId);
}

export function accountIdDigits(accountId: string): string {
  const normalized = normalizeAccountIdInput(accountId);
  return normalized.slice(ACT_PREFIX.length);
}
