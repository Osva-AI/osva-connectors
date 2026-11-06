import { GoogleAuth, JWT } from "google-auth-library";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface CalendarTokenProviderOptions {
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
}

export interface CalendarTokenProvider {
  getAuthorizationHeader(
    options?: CalendarTokenProviderOptions,
  ): Promise<string>;
}

async function raceAuthOperation<T>(
  operation: Promise<T>,
  options?: CalendarTokenProviderOptions,
): Promise<T> {
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const deadlineMs = options?.deadlineMs;
  if (deadlineMs !== undefined && deadlineMs <= 0) {
    throw new Error("Google Calendar request timed out.");
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
        reject(new Error("Google Calendar request timed out."));
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
  readonly scopes: readonly string[];
  readonly subject?: string;
}

export function createGoogleAuthTokenProvider(
  options: CreateGoogleAuthTokenProviderOptions,
): CalendarTokenProvider {
  const scopes = [...options.scopes];
  const subject = options.subject;

  const auth = new GoogleAuth({
    scopes,
  });

  return {
    async getAuthorizationHeader(opts) {
      try {
        const client = await raceAuthOperation(auth.getClient(), opts);
        if (subject !== undefined) {
          if (!(client instanceof JWT)) {
            throw new ConnectorSdkError(
              "CONFIGURATION_ERROR",
              "Domain-wide delegation requires a service account credential.",
            );
          }
          client.subject = subject;
        }

        const tokenResponse = await raceAuthOperation(
          client.getAccessToken(),
          opts,
        );
        const token =
          typeof tokenResponse === "string"
            ? tokenResponse
            : (tokenResponse as { token?: string | null } | null | undefined)
                ?.token;

        if (token === null || token === undefined || token.length === 0) {
          throw new ConnectorSdkError(
            "UNAUTHORIZED",
            "Google Calendar credentials are not available.",
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
          "Google Calendar authentication failed.",
        );
      }
    },
  };
}

export function createStaticBearerTokenProvider(
  accessToken: string,
): CalendarTokenProvider {
  const trimmed = accessToken.trim();
  return {
    async getAuthorizationHeader(options) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (options?.deadlineMs !== undefined && options.deadlineMs <= 0) {
        throw new Error("Google Calendar request timed out.");
      }
      if (trimmed.length === 0) {
        throw new ConnectorSdkError(
          "UNAUTHORIZED",
          "Google Calendar credentials are not available.",
        );
      }
      return `Bearer ${trimmed}`;
    },
  };
}
