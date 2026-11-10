import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const PROJECT_EQ = /\bproject\s*=\s*["']?([A-Za-z][A-Za-z0-9_]*)["']?/gi;
const PROJECT_IN = /\bproject\s+in\s*\(\s*([^)]+)\)/gi;
const PROJECT_NOT_IN = /\bproject\s+not\s+in\s*\(\s*([^)]+)\)/gi;
const ORDER_BY = /\border\s+by\b/i;
const UNSUPPORTED_JQL =
  /\b(?:issueFunction|membersOf|openSprints|closedSprints|linkedIssues|subtaskIssues|portfolioChildIssuesOf)\s*\(/i;

export function splitJqlOrderBy(jql: string): {
  readonly predicate: string;
  readonly orderBy?: string;
} {
  const match = jql.match(ORDER_BY);
  if (match === null || match.index === undefined) {
    return { predicate: jql.trim() };
  }
  const predicate = jql.slice(0, match.index).trim();
  const orderBy = jql.slice(match.index).trim();
  if (predicate.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "JQL ORDER BY must follow a search predicate.",
    );
  }
  return { predicate, orderBy };
}

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

  const { predicate } = splitJqlOrderBy(jql);
  if (UNSUPPORTED_JQL.test(predicate)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "This JQL form is not permitted when a project allowlist is configured.",
    );
  }

  const referenced = new Set<string>();

  for (const match of predicate.matchAll(PROJECT_EQ)) {
    const key = match[1];
    if (key !== undefined) {
      referenced.add(key.toUpperCase());
    }
  }
  for (const match of predicate.matchAll(PROJECT_IN)) {
    const inner = match[1];
    if (inner !== undefined) {
      for (const key of parseKeyList(inner)) {
        referenced.add(key);
      }
    }
  }
  if (PROJECT_NOT_IN.test(predicate)) {
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
  const { predicate, orderBy } = splitJqlOrderBy(jql);
  if (predicate.length === 0) {
    return orderBy !== undefined
      ? `project in (${list}) ${orderBy}`
      : `project in (${list})`;
  }
  const scoped = `(${predicate}) AND project in (${list})`;
  return orderBy !== undefined ? `${scoped} ${orderBy}` : scoped;
}
