import { GoogleAuth } from "google-auth-library";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { GA4_READONLY_SCOPE } from "./constants.js";

export interface Ga4TokenProvider {
  getAuthorizationHeader(signal?: AbortSignal): Promise<string>;
}

export interface CreateGoogleAuthTokenProviderOptions {
  readonly scopes?: readonly string[];
}

export function createGoogleAuthTokenProvider(
  options?: CreateGoogleAuthTokenProviderOptions,
): Ga4TokenProvider {
  const scopes = options?.scopes ? [...options.scopes] : [GA4_READONLY_SCOPE];
  const auth = new GoogleAuth({
    scopes,
  });

  return {
    async getAuthorizationHeader(signal) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const tokenResponse = await auth.getAccessToken();
        const token =
          typeof tokenResponse === "string"
            ? tokenResponse
            : (tokenResponse as { token?: string | null } | null | undefined)
                ?.token;
        if (token === null || token === undefined || token.length === 0) {
          throw new ConnectorSdkError(
            "UNAUTHORIZED",
            "Google Analytics credentials are not available.",
          );
        }
        return `Bearer ${token}`;
      } catch (error) {
        if (error instanceof ConnectorSdkError) {
          throw error;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        throw new ConnectorSdkError(
          "UNAUTHORIZED",
          "Google Analytics authentication failed.",
        );
      }
    },
  };
}

export function createStaticBearerTokenProvider(
  accessToken: string,
): Ga4TokenProvider {
  const trimmed = accessToken.trim();
  return {
    async getAuthorizationHeader(signal) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (trimmed.length === 0) {
        throw new ConnectorSdkError(
          "UNAUTHORIZED",
          "Google Analytics credentials are not available.",
        );
      }
      return `Bearer ${trimmed}`;
    },
  };
}
