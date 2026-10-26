import { GoogleAuth } from "google-auth-library";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { DRIVE_READONLY_SCOPE } from "./constants.js";

export interface DriveTokenProviderOptions {
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
}

export interface DriveTokenProvider {
  getAuthorizationHeader(options?: DriveTokenProviderOptions): Promise<string>;
}

async function raceAuthOperation<T>(
  operation: Promise<T>,
  options?: DriveTokenProviderOptions,
): Promise<T> {
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const deadlineMs = options?.deadlineMs;
  if (deadlineMs !== undefined && deadlineMs <= 0) {
    throw new Error("Google Drive request timed out.");
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
        reject(new Error("Google Drive request timed out."));
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
): DriveTokenProvider {
  const scopes = options?.scopes ? [...options.scopes] : [DRIVE_READONLY_SCOPE];
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
            "Google Drive credentials are not available.",
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
          "Google Drive authentication failed.",
        );
      }
    },
  };
}

export function createStaticBearerTokenProvider(
  accessToken: string,
): DriveTokenProvider {
  const trimmed = accessToken.trim();
  return {
    async getAuthorizationHeader(options) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (options?.deadlineMs !== undefined && options.deadlineMs <= 0) {
        throw new Error("Google Drive request timed out.");
      }
      if (trimmed.length === 0) {
        throw new ConnectorSdkError(
          "UNAUTHORIZED",
          "Google Drive credentials are not available.",
        );
      }
      return `Bearer ${trimmed}`;
    },
  };
}
