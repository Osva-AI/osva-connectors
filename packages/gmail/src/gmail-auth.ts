import { GoogleAuth, JWT } from "google-auth-library";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface GmailTokenProviderOptions {
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
}

export interface GmailTokenProvider {
  getAuthorizationHeader(options?: GmailTokenProviderOptions): Promise<string>;
}

async function raceAuthOperation<T>(
  operation: Promise<T>,
  options?: GmailTokenProviderOptions,
): Promise<T> {
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const deadlineMs = options?.deadlineMs;
  if (deadlineMs !== undefined && deadlineMs <= 0) {
    throw new Error("Gmail request timed out.");
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
        reject(new Error("Gmail request timed out."));
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
  /** Workspace domain-wide delegation: user email to impersonate (service account + admin consent). */
  readonly subject?: string;
}

/**
 * Application Default Credentials or service account JSON via GOOGLE_APPLICATION_CREDENTIALS.
 * Optional `subject` enables domain-wide delegation (JWT client only).
 */
export function createGoogleAuthTokenProvider(
  options: CreateGoogleAuthTokenProviderOptions,
): GmailTokenProvider {
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
            "Gmail credentials are not available.",
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
          "Gmail authentication failed.",
        );
      }
    },
  };
}

export function createStaticBearerTokenProvider(
  accessToken: string,
): GmailTokenProvider {
  const trimmed = accessToken.trim();
  return {
    async getAuthorizationHeader(options) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (options?.deadlineMs !== undefined && options.deadlineMs <= 0) {
        throw new Error("Gmail request timed out.");
      }
      if (trimmed.length === 0) {
        throw new ConnectorSdkError(
          "UNAUTHORIZED",
          "Gmail credentials are not available.",
        );
      }
      return `Bearer ${trimmed}`;
    },
  };
}
