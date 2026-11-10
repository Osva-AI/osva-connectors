export function createRequestAbortSignal(
  requestTimeoutMs: number,
  parentSignal?: AbortSignal,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
  if (parentSignal === undefined) {
    return timeoutSignal;
  }
  if (parentSignal.aborted) {
    return parentSignal;
  }
  return AbortSignal.any([parentSignal, timeoutSignal]);
}
