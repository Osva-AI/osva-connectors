import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface OneDriveTokenProviderOptions {
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
}

export interface OneDriveTokenProvider {
  getAuthorizationHeader(
    options?: OneDriveTokenProviderOptions,
  ): Promise<string>;
}

export function createStaticBearerTokenProvider(
  accessToken: string,
): OneDriveTokenProvider {
  const trimmed = accessToken.trim();
  return {
    async getAuthorizationHeader(options) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (options?.deadlineMs !== undefined && options.deadlineMs <= 0) {
        throw new Error("OneDrive request timed out.");
      }
      if (trimmed.length === 0) {
        throw new ConnectorSdkError(
          "UNAUTHORIZED",
          "OneDrive credentials are not available.",
        );
      }
      return `Bearer ${trimmed}`;
    },
  };
}
