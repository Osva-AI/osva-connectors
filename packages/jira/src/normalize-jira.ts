import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { adfPlainText } from "./adf.js";
import {
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";
import { parseIssueKey, parseProjectKey } from "./jira-id.js";

export interface NormalizedJiraIssue {
  readonly id?: string;
  readonly key: string;
  readonly projectKey?: string;
  readonly summary?: string;
  readonly descriptionText?: string;
  readonly status?: string;
  readonly issueType?: string;
  readonly untrustedContent: true;
}

export interface NormalizedJiraProject {
  readonly id: string;
  readonly key: string;
  readonly name?: string;
  readonly untrustedContent: true;
}

export interface NormalizedJiraTransition {
  readonly id: string;
  readonly name?: string;
  readonly untrustedContent: true;
}

function requireRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", message);
  }
  return value as Record<string, unknown>;
}

export function extractIssueProjectKey(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const fields =
    record.fields !== null && typeof record.fields === "object"
      ? (record.fields as Record<string, unknown>)
      : undefined;
  const project =
    fields?.project !== null && typeof fields?.project === "object"
      ? (fields.project as Record<string, unknown>)
      : undefined;
  if (typeof project?.key === "string") {
    return parseProjectKey(project.key, "project key");
  }
  if (typeof record.key === "string") {
    const match = /^([A-Z][A-Z0-9_]*)-\d+$/i.exec(record.key.trim());
    if (match?.[1] !== undefined) {
      return parseProjectKey(match[1], "project key");
    }
  }
  return undefined;
}

export function normalizeProjectRecord(raw: unknown): NormalizedJiraProject {
  const record = requireRecord(raw, "Jira returned an unexpected payload.");
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const key =
    typeof record.key === "string"
      ? parseProjectKey(record.key, "project key")
      : "";
  if (id.length === 0 || key.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  const name =
    typeof record.name === "string"
      ? normalizeTruncatableProviderString(
          record.name,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;
  return {
    id,
    key,
    ...(name !== undefined ? { name } : {}),
    untrustedContent: true as const,
  };
}

export function normalizeIssueRecord(raw: unknown): NormalizedJiraIssue {
  const record = requireRecord(raw, "Jira returned an unexpected payload.");
  const key =
    typeof record.key === "string"
      ? parseIssueKey(record.key, "issue key")
      : "";
  if (key.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  const id = typeof record.id === "string" ? record.id.trim() : undefined;
  const fields =
    record.fields !== null && typeof record.fields === "object"
      ? (record.fields as Record<string, unknown>)
      : undefined;

  const summary =
    fields !== undefined && typeof fields.summary === "string"
      ? normalizeTruncatableProviderString(
          fields.summary,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;

  const descriptionText =
    fields !== undefined ? adfPlainText(fields.description) : undefined;

  const status =
    fields?.status !== null &&
    typeof fields?.status === "object" &&
    typeof (fields.status as Record<string, unknown>).name === "string"
      ? normalizeTruncatableProviderString(
          (fields.status as Record<string, unknown>).name as string,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;

  const issueType =
    fields?.issuetype !== null &&
    typeof fields?.issuetype === "object" &&
    typeof (fields.issuetype as Record<string, unknown>).name === "string"
      ? normalizeTruncatableProviderString(
          (fields.issuetype as Record<string, unknown>).name as string,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;

  const projectKey = extractIssueProjectKey(raw);

  return {
    ...(id !== undefined && id.length > 0 ? { id } : {}),
    key,
    ...(projectKey !== undefined ? { projectKey } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(descriptionText !== undefined ? { descriptionText } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(issueType !== undefined ? { issueType } : {}),
    untrustedContent: true as const,
  };
}

export function normalizeTransitionList(
  raw: unknown,
): NormalizedJiraTransition[] {
  const record = requireRecord(raw, "Jira returned an unexpected payload.");
  const transitions = record.transitions;
  if (!Array.isArray(transitions)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  const out: NormalizedJiraTransition[] = [];
  for (const entry of transitions) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const t = entry as Record<string, unknown>;
    const id = typeof t.id === "string" ? t.id.trim() : "";
    if (id.length === 0) {
      continue;
    }
    const name =
      typeof t.name === "string"
        ? normalizeTruncatableProviderString(
            t.name,
            OUTPUT_MAX_PROVIDER_STRING_LENGTH,
          ).value
        : undefined;
    out.push({
      id,
      ...(name !== undefined ? { name } : {}),
      untrustedContent: true as const,
    });
  }
  return out;
}

export function normalizeCreateIssueResponse(raw: unknown): {
  readonly id: string;
  readonly key: string;
} {
  const record = requireRecord(raw, "Jira returned an unexpected payload.");
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const key =
    typeof record.key === "string"
      ? parseIssueKey(record.key, "issue key")
      : "";
  if (id.length === 0 || key.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  return { id, key };
}
