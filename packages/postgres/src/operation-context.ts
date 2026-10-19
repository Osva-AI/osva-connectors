import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export function createAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

export function createTotalDeadlineError(): ConnectorSdkError {
  return new ConnectorSdkError(
    "TIMEOUT",
    "PostgreSQL request exceeded the total operation deadline.",
    { retryable: true },
  );
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

export function isTotalDeadlineError(error: unknown): boolean {
  return (
    error instanceof ConnectorSdkError &&
    error.code === "TIMEOUT" &&
    error.message ===
      "PostgreSQL request exceeded the total operation deadline."
  );
}

export function requiresConnectionDestroy(error: unknown): boolean {
  return isAbortError(error) || isTotalDeadlineError(error);
}

export class PostgresOperationContext {
  private readonly startedAtMs = Date.now();

  constructor(
    private readonly totalTimeoutMs: number,
    private readonly signal?: AbortSignal,
  ) {}

  remainingMs(): number {
    return this.totalTimeoutMs - (Date.now() - this.startedAtMs);
  }

  assertActive(): void {
    if (this.signal?.aborted) {
      throw createAbortError();
    }
    if (this.remainingMs() <= 0) {
      throw createTotalDeadlineError();
    }
  }

  race<T>(operation: Promise<T>): Promise<T> {
    this.assertActive();
    const remainingMs = this.remainingMs();
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const settle = (handler: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        handler();
      };

      const onAbort = () => {
        settle(() => {
          reject(createAbortError());
        });
      };
      const onDeadline = () => {
        settle(() => {
          reject(createTotalDeadlineError());
        });
      };

      const timer = setTimeout(onDeadline, remainingMs);
      if (this.signal?.aborted) {
        onAbort();
      } else if (this.signal !== undefined) {
        this.signal.addEventListener("abort", onAbort, { once: true });
      }

      const cleanup = () => {
        clearTimeout(timer);
        if (this.signal !== undefined) {
          this.signal.removeEventListener("abort", onAbort);
        }
      };

      operation.then(
        (value) => {
          settle(() => {
            resolve(value);
          });
        },
        (error: unknown) => {
          settle(() => {
            reject(error);
          });
        },
      );
    });
  }
}
