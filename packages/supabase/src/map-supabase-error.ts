import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface SupabaseErrorRedaction {
  readonly publishableKey?: string;
  readonly userAccessToken?: string;
}

export interface SupabaseHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly body?: string;
}

function redactSecrets(
  message: string,
  tokens: SupabaseErrorRedaction,
): string {
  let result = message;
  for (const token of [tokens.publishableKey, tokens.userAccessToken]) {
    if (token !== undefined && token.length > 0) {
      result = result.replaceAll(token, "[REDACTED]");
    }
  }
  return result;
}

export function mapSupabaseError(
  error: unknown,
  redaction?: SupabaseErrorRedaction,
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ConnectorSdkError("TIMEOUT", "Supabase request was aborted.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    (error as SupabaseHttpError).kind === "http"
  ) {
    const http = error as SupabaseHttpError;
    const base = `Supabase API returned HTTP ${http.status}.`;
    const message =
      redaction !== undefined ? redactSecrets(base, redaction) : base;
    if (http.status === 401 || http.status === 403) {
      return new ConnectorSdkError("FORBIDDEN", message);
    }
    if (http.status === 404) {
      return new ConnectorSdkError("NOT_FOUND", message);
    }
    if (http.status === 408 || http.status === 504) {
      return new ConnectorSdkError("TIMEOUT", message);
    }
    if (http.status === 429) {
      return new ConnectorSdkError("RATE_LIMITED", message);
    }
    if (http.status >= 500) {
      return new ConnectorSdkError("PROVIDER_ERROR", message);
    }
    return new ConnectorSdkError("PROVIDER_ERROR", message);
  }
  if (error instanceof Error) {
    const message =
      redaction !== undefined
        ? redactSecrets(error.message, redaction)
        : error.message;
    return new ConnectorSdkError("PROVIDER_ERROR", message);
  }
  return new ConnectorSdkError("PROVIDER_ERROR", "Supabase request failed.");
}
