import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface ResourceAllowlist {
  readonly allowedIds: ReadonlySet<string>;
}

export function createResourceAllowlist(
  ids: readonly string[] | undefined,
): ResourceAllowlist | undefined {
  if (ids === undefined) {
    return undefined;
  }
  return { allowedIds: new Set(ids) };
}

export function assertResourceAllowed(
  allowlist: ResourceAllowlist | undefined,
  resourceId: string,
  label: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} allowlist is explicitly empty; no ${label.toLowerCase()} resources are permitted.`,
    );
  }
  if (!allowlist.allowedIds.has(resourceId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `The requested ${label.toLowerCase()} is not in the configured allowlist.`,
    );
  }
}
