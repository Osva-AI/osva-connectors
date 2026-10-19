import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { ShopifyGraphqlHttpError } from "./shopify-graphql-client.js";

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  return false;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Error & { code?: string }).code;
  return (
    error.name === "TimeoutError" ||
    error.message.includes("timed out") ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT"
  );
}

function redactSecrets(message: string, accessToken?: string): string {
  let result = message;
  if (accessToken !== undefined && accessToken.length > 0) {
    result = result.split(accessToken).join("[REDACTED]");
  }
  result = result.replace(/shpat_[a-zA-Z0-9]+/g, "[REDACTED]");
  result = result.replace(
    /X-Shopify-Access-Token:\s*\S+/gi,
    "X-Shopify-Access-Token: [REDACTED]",
  );
  return result;
}

function mapGraphqlUserErrors(
  messages: readonly string[],
  accessToken?: string,
): ConnectorSdkError {
  const combined = messages.join(" ").toLowerCase();
  const sanitized = redactSecrets(
    messages[0] ?? "GraphQL request failed.",
    accessToken,
  );

  if (
    combined.includes("access denied") ||
    combined.includes("not authorized")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Shopify denied access for this request. Verify Admin API scopes and protected customer data settings.",
    );
  }
  if (combined.includes("not found") || combined.includes("does not exist")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Shopify resource was not found.",
    );
  }
  if (combined.includes("throttled") || combined.includes("rate limit")) {
    return rateLimitError("Shopify rate limit exceeded.");
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    sanitized.length > 200
      ? "Shopify rejected the GraphQL request."
      : sanitized,
  );
}

export interface MapShopifyErrorOptions {
  readonly accessToken?: string;
}

export function mapShopifyError(
  error: unknown,
  options?: MapShopifyErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Shopify request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as ShopifyGraphqlHttpError).kind === "http"
  ) {
    const httpError = error as ShopifyGraphqlHttpError;
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Shopify authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Shopify denied access to this shop or resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Shopify endpoint was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Shopify rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Shopify is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as { kind: string }).kind === "graphql"
  ) {
    const gqlError = error as {
      kind: "graphql";
      messages: readonly string[];
      throttled?: boolean;
    };
    if (gqlError.throttled === true) {
      return rateLimitError("Shopify rate limit exceeded.");
    }
    if (gqlError.messages.length > 0) {
      return mapGraphqlUserErrors(gqlError.messages, accessToken);
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Shopify.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Shopify.",
  );
}
