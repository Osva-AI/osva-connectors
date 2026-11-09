import { ConnectorSdkError } from "@osva-ai/connector-sdk";

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  );
}

export function mapProviderError(error: unknown): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  const code =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "number"
      ? (error as { code: number }).code
      : undefined;

  if (code === 404) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "BigQuery resource was not found.",
    );
  }
  if (code === 403) {
    return new ConnectorSdkError("FORBIDDEN", "BigQuery access was denied.");
  }

  const message =
    error instanceof Error
      ? error.message
      : "Unexpected BigQuery provider error.";
  return new ConnectorSdkError("PROVIDER_ERROR", message, { retryable: true });
}
