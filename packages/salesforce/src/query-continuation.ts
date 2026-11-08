import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export type QueryFamily = "account" | "contact" | "opportunity";

const TOKEN_VERSION = 1;
const QUERY_LOCATOR_PATTERN = /^\/query\/[A-Za-z0-9\-]+$/;
const MAX_CONTINUATION_TOKEN_BYTES = 4_096;

export interface ContinuationPayload {
  readonly v: typeof TOKEN_VERSION;
  readonly family: QueryFamily;
  readonly filterFingerprint: string;
  readonly locatorSuffix: string;
}

export function fingerprintFilters(
  filters: Readonly<Record<string, string | undefined>>,
): string {
  const keys = Object.keys(filters).sort();
  const normalized: Record<string, string> = {};
  for (const key of keys) {
    const value = filters[key];
    if (value !== undefined && value.length > 0) {
      normalized[key] = value;
    }
  }
  return JSON.stringify(normalized);
}

export function encodeContinuationToken(payload: ContinuationPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  if (Buffer.byteLength(encoded, "utf8") > MAX_CONTINUATION_TOKEN_BYTES) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce continuation token exceeds size limit.",
    );
  }
  return encoded;
}

export function decodeContinuationToken(token: string): ContinuationPayload {
  const trimmed = token.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CONTINUATION_TOKEN_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token is invalid.",
    );
  }
  let parsed: unknown;
  try {
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token is invalid.",
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token is invalid.",
    );
  }
  const row = parsed as Record<string, unknown>;
  if (
    row.v !== TOKEN_VERSION ||
    typeof row.family !== "string" ||
    typeof row.filterFingerprint !== "string" ||
    typeof row.locatorSuffix !== "string"
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token is invalid.",
    );
  }
  if (!["account", "contact", "opportunity"].includes(row.family)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token is invalid.",
    );
  }
  if (!QUERY_LOCATOR_PATTERN.test(row.locatorSuffix)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token is invalid.",
    );
  }
  return {
    v: TOKEN_VERSION,
    family: row.family as QueryFamily,
    filterFingerprint: row.filterFingerprint,
    locatorSuffix: row.locatorSuffix,
  };
}

export function assertContinuationScope(
  payload: ContinuationPayload,
  family: QueryFamily,
  filterFingerprint: string,
): void {
  if (payload.family !== family) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token does not match this list tool.",
    );
  }
  if (payload.filterFingerprint !== filterFingerprint) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Continuation token does not match the active query filters.",
    );
  }
}

/**
 * Validates a Salesforce nextRecordsUrl and returns the allowlisted locator suffix
 * (path relative to the REST API data root, e.g. /query/01gXXXXXXXX-2000).
 */
export function parseValidatedQueryLocator(
  nextRecordsUrl: string,
  pinnedOrigin: string,
  apiDataBaseUrl: string,
  expectedApiVersionPath: string,
): string {
  let parsed: URL;
  try {
    parsed = new URL(nextRecordsUrl);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce continuation URL is invalid.",
    );
  }
  if (parsed.origin !== pinnedOrigin) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce continuation URL origin is not allowed.",
    );
  }
  if (parsed.username || parsed.password) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce continuation URL is not allowed.",
    );
  }
  const basePath = new URL(apiDataBaseUrl).pathname.replace(/\/$/, "");
  if (!parsed.pathname.startsWith(basePath)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce continuation URL is not allowed.",
    );
  }
  const afterVersion = parsed.pathname.slice(basePath.length) || "/";
  if (!afterVersion.startsWith("/query/")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce continuation URL is not a query locator.",
    );
  }
  if (expectedApiVersionPath !== basePath) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce continuation URL API version mismatch.",
    );
  }
  const locatorSuffix = afterVersion.split("?")[0] ?? afterVersion;
  if (!QUERY_LOCATOR_PATTERN.test(locatorSuffix)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce query locator path is invalid.",
    );
  }
  return locatorSuffix;
}
