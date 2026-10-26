import { GoogleAuth } from "google-auth-library";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { GOOGLE_ADS_SCOPE } from "./constants.js";

export interface GoogleAdsTokenProviderOptions {
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
}

export interface GoogleAdsTokenProvider {
  getAuthorizationHeader(
    options?: GoogleAdsTokenProviderOptions,
  ): Promise<string>;
}

async function raceAuthOperation<T>(
  operation: Promise<T>,
  options?: GoogleAdsTokenProviderOptions,
): Promise<T> {
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const deadlineMs = options?.deadlineMs;
  if (deadlineMs !== undefined && deadlineMs <= 0) {
    throw new Error("Google Ads request timed out.");
  }

  return new Promise<T>((resolve, reject) => {
    const signal = options?.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => {
      signal?.removeEventListener("abort", onAbort);
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
    const onAbort = (): void => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (deadlineMs !== undefined) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error("Google Ads request timed out."));
      }, deadlineMs);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export interface CreateGoogleAuthTokenProviderOptions {
  readonly scopes?: readonly string[];
}

export function createGoogleAuthTokenProvider(
  options?: CreateGoogleAuthTokenProviderOptions,
): GoogleAdsTokenProvider {
  const scopes = options?.scopes ? [...options.scopes] : [GOOGLE_ADS_SCOPE];
  const auth = new GoogleAuth({
    scopes,
  });

  return {
    async getAuthorizationHeader(options) {
      try {
        const tokenResponse = await raceAuthOperation(
          auth.getAccessToken(),
          options,
        );
        const token =
          typeof tokenResponse === "string"
            ? tokenResponse
            : (tokenResponse as { token?: string | null } | null | undefined)
                ?.token;
        if (token === null || token === undefined || token.length === 0) {
          throw new ConnectorSdkError(
            "UNAUTHORIZED",
            "Google Ads credentials are not available.",
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
          "Google Ads authentication failed.",
        );
      }
    },
  };
}

export function createStaticBearerTokenProvider(
  accessToken: string,
): GoogleAdsTokenProvider {
  const trimmed = accessToken.trim();
  return {
    async getAuthorizationHeader(options) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (options?.deadlineMs !== undefined && options.deadlineMs <= 0) {
        throw new Error("Google Ads request timed out.");
      }
      if (trimmed.length === 0) {
        throw new ConnectorSdkError(
          "UNAUTHORIZED",
          "Google Ads credentials are not available.",
        );
      }
      return `Bearer ${trimmed}`;
    },
  };
}
