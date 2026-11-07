import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const PROJECT_EQ = /\bproject\s*=\s*["']?([A-Za-z][A-Za-z0-9_]*)["']?/gi;
const PROJECT_IN = /\bproject\s+in\s*\(\s*([^)]+)\)/gi;
const PROJECT_NOT_IN = /\bproject\s+not\s+in\s*\(\s*([^)]+)\)/gi;

function parseKeyList(inner: string): string[] {
  const keys: string[] = [];
  const parts = inner.split(",");
  for (const part of parts) {
    const trimmed = part.trim().replace(/^["']|["']$/g, "");
    if (trimmed.length > 0) {
      keys.push(trimmed.toUpperCase());
    }
  }
  return keys;
}

export function assertJqlRespectsProjectAllowlist(
  jql: string,
  allowedKeys: ReadonlySet<string>,
): void {
  if (allowedKeys.size === 0) {
    return;
  }

  const referenced = new Set<string>();

  for (const match of jql.matchAll(PROJECT_EQ)) {
    const key = match[1];
    if (key !== undefined) {
      referenced.add(key.toUpperCase());
    }
  }
  for (const match of jql.matchAll(PROJECT_IN)) {
    const inner = match[1];
    if (inner !== undefined) {
      for (const key of parseKeyList(inner)) {
        referenced.add(key);
      }
    }
  }
  if (PROJECT_NOT_IN.test(jql)) {
    PROJECT_NOT_IN.lastIndex = 0;
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Cross-project JQL is not permitted when a project allowlist is configured.",
    );
  }

  for (const key of referenced) {
    if (!allowedKeys.has(key)) {
      throw new ConnectorSdkError(
        "FORBIDDEN",
        "JQL references a project outside OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS.",
      );
    }
  }
}

export function wrapJqlWithProjectAllowlist(
  jql: string,
  allowedKeys: ReadonlySet<string>,
): string {
  if (allowedKeys.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Project allowlist is explicitly empty; issue search is not permitted.",
    );
  }
  assertJqlRespectsProjectAllowlist(jql, allowedKeys);
  const list = [...allowedKeys].sort().join(", ");
  const trimmed = jql.trim();
  if (trimmed.length === 0) {
    return `project in (${list})`;
  }
  return `(${trimmed}) AND project in (${list})`;
}
