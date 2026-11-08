import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactWoocommerceSecrets } from "./woocommerce-auth.js";
import type { WoocommerceHttpError } from "./woocommerce-rest-client.js";

export interface MapWoocommerceErrorOptions {
  readonly consumerKey?: string;
  readonly consumerSecret?: string;
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
function mapWoocommerceErrorBody(status: number, message: string | undefined) {
  const combined = (message ?? "").toLowerCase();
  if (status === 401 || combined.includes("woocommerce_rest_authentication")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "WooCommerce REST credentials are invalid.",
    );
  }
  if (status === 403 || combined.includes("cannot view")) {
    return new ConnectorSdkError("FORBIDDEN", "WooCommerce denied access.");
  }
  if (status === 404) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "WooCommerce resource was not found.",
    );
  }
  if (status === 400) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "WooCommerce rejected the request parameters.",
    );
  }
  if (
    status === 429 ||
    combined.includes("rate limit") ||
    combined.includes("too many")
  ) {
    return rateLimitError("WooCommerce rate limit exceeded.");
  }
  return undefined;
}
export function mapWoocommerceError(
  error: unknown,
  options: MapWoocommerceErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "WooCommerce request timed out.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as WoocommerceHttpError).kind === "http"
  ) {
    const httpError = error as WoocommerceHttpError;
    const mapped = mapWoocommerceErrorBody(
      httpError.status,
      httpError.wooMessage,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        options.ambiguousWrite === true
          ? "WooCommerce write outcome is ambiguous after a server error."
          : "WooCommerce returned a server error.",
      );
    }
    const message = redactWoocommerceSecrets(
      httpError.wooMessage ?? "WooCommerce request failed.",
      options.consumerKey,
      options.consumerSecret,
    );
    return new ConnectorSdkError("PROVIDER_ERROR", message);
  }
  if (error instanceof Error) {
    const message = redactWoocommerceSecrets(
      error.message,
      options.consumerKey,
      options.consumerSecret,
    );
    return new ConnectorSdkError("PROVIDER_ERROR", message);
  }
  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "WooCommerce request failed unexpectedly.",
  );
}
