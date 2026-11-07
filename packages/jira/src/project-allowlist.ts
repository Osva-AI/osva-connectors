import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface ProjectAllowlist {
  readonly allowedKeys: ReadonlySet<string>;
}

export function createProjectAllowlist(
  keys: readonly string[] | undefined,
): ProjectAllowlist | undefined {
  if (keys === undefined) {
    return undefined;
  }
  const normalized = new Set<string>();
  for (const key of keys) {
    normalized.add(key.toUpperCase());
  }
  return { allowedKeys: normalized };
}

export function assertProjectAllowed(
  allowlist: ProjectAllowlist | undefined,
  projectKey: string,
  label: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedKeys.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Project allowlist is explicitly empty; no project keys are permitted.",
    );
  }
  const normalized = projectKey.trim().toUpperCase();
  if (!allowlist.allowedKeys.has(normalized)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} is not on the host-configured project allowlist.`,
    );
  }
}

export function assertMutationsProjectAllowlistReady(
  allowlist: ProjectAllowlist | undefined,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedKeys.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Jira mutations require a non-empty OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS when the allowlist env var is set.",
    );
  }
}

export function filterByProjectAllowlist<T>(
  allowlist: ProjectAllowlist | undefined,
  items: readonly T[],
  projectKeyOf: (item: T) => string | undefined,
): T[] {
  if (allowlist === undefined) {
    return [...items];
  }
  if (allowlist.allowedKeys.size === 0) {
    return [];
  }
  return items.filter((item) => {
    const key = projectKeyOf(item);
    if (key === undefined) {
      return false;
    }
    return allowlist.allowedKeys.has(key.trim().toUpperCase());
  });
}
