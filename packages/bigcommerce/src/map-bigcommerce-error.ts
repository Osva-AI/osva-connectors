import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactBigcommerceSecrets } from "./bigcommerce-auth.js";
import type { BigcommerceHttpError } from "./bigcommerce-rest-client.js";

export interface MapBigcommerceErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousWrite?: boolean;
}

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
function mapBigcommerceErrorBody(status: number, message: string | undefined) {
  const combined = (message ?? "").toLowerCase();
  if (status === 401) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "BigCommerce access token is invalid.",
    );
  }
  if (status === 403) {
    return new ConnectorSdkError("FORBIDDEN", "BigCommerce denied access.");
  }
  if (status === 404) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "BigCommerce resource was not found.",
    );
  }
  if (status === 400 || combined.includes("validation")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "BigCommerce rejected the request parameters.",
    );
  }
  if (status === 429) {
    return rateLimitError("BigCommerce rate limit exceeded.");
  }
  return undefined;
}
export function mapBigcommerceError(
  error: unknown,
  options: MapBigcommerceErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "BigCommerce request timed out.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as BigcommerceHttpError).kind === "http"
  ) {
    const httpError = error as BigcommerceHttpError;
    const mapped = mapBigcommerceErrorBody(
      httpError.status,
      httpError.bcMessage,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        options.ambiguousWrite === true
          ? "BigCommerce write outcome is ambiguous after a server error."
          : "BigCommerce returned a server error.",
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactBigcommerceSecrets(
        httpError.bcMessage ?? "BigCommerce request failed.",
        options.accessToken,
      ),
    );
  }
  if (error instanceof Error) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactBigcommerceSecrets(error.message, options.accessToken),
    );
  }
  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "BigCommerce request failed unexpectedly.",
  );
}
