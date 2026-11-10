function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("aborted")))
  );
}

/**
 * Binds an in-flight SDK promise to an AbortSignal for client-side deadlines.
 * Does not guarantee provider-side cancellation unless the caller handles it.
 */
export function runWithAbortSignal<T>(
  signal: AbortSignal,
  operation: () => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
    void operation()
      .then((value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      })
      .catch((error) => {
        signal.removeEventListener("abort", onAbort);
        if (isAbortError(error)) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        reject(error);
      });
  });
}

export async function cancelBigQueryJobBestEffort(job: {
  cancel: () => Promise<unknown>;
}): Promise<void> {
  try {
    await job.cancel();
  } catch {
    // Best-effort; client abort still returns CANCELLED to the MCP caller.
  }
}
