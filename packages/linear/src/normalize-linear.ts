import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  normalizeTruncatableProviderString,
} from "./output-budget.js";
import type { LinearListResult, LinearPageInfo } from "./linear-client.js";
import { formatLinearIdForApi } from "./linear-id.js";

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `Linear returned an unexpected ${label}.`,
    );
  }
  return value as Record<string, unknown>;
}

function parsePageInfo(value: unknown): LinearPageInfo {
  const record = requireRecord(value, "page info");
  return {
    hasNextPage: record.hasNextPage === true,
    endCursor: typeof record.endCursor === "string" ? record.endCursor : null,
  };
}

function normalizeOptionalString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = normalizeTruncatableProviderString(value, maxLength);
  return normalized.value.length > 0 ? normalized.value : undefined;
}

function normalizeTeamRef(
  value: unknown,
): { id: string; key?: string; name?: string } | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const record = requireRecord(value, "team");
  const id = record.id;
  if (typeof id !== "string") {
    return undefined;
  }
  return {
    id: id.toLowerCase(),
    ...(typeof record.key === "string" ? { key: record.key } : {}),
    ...(typeof record.name === "string" ? { name: record.name } : {}),
  };
}

export function normalizeViewerRecord(raw: unknown): Record<string, unknown> {
  const record = requireRecord(raw, "viewer");
  const displayName = normalizeOptionalString(
    record.displayName ?? record.name,
    256,
  );
  const email = normalizeOptionalString(record.email, 320);
  return {
    id: typeof record.id === "string" ? record.id.toLowerCase() : undefined,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(email !== undefined ? { email } : {}),
    active: record.active === true,
  };
}

export function normalizeTeamRecord(raw: unknown): Record<string, unknown> {
  const record = requireRecord(raw, "team");
  const name = normalizeOptionalString(record.name, 256);
  return {
    id: typeof record.id === "string" ? record.id.toLowerCase() : undefined,
    ...(typeof record.key === "string" ? { key: record.key } : {}),
    ...(name !== undefined ? { name } : {}),
  };
}

export function normalizeProjectRecord(raw: unknown): Record<string, unknown> {
  const record = requireRecord(raw, "project");
  const name = normalizeOptionalString(record.name, 256);
  const description = normalizeOptionalString(
    record.description,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const team = normalizeTeamRef(record.team);
  return {
    id: typeof record.id === "string" ? record.id.toLowerCase() : undefined,
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined
      ? {
          description,
          untrustedContent: true as const,
        }
      : {}),
    ...(team !== undefined ? { team } : {}),
    ...(typeof record.state === "string" ? { state: record.state } : {}),
  };
}

export function normalizeIssueRecord(raw: unknown): Record<string, unknown> {
  const record = requireRecord(raw, "issue");
  const title = normalizeOptionalString(record.title, 512);
  const description = normalizeOptionalString(
    record.description,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const team = normalizeTeamRef(record.team);
  const project = normalizeTeamRef(record.project);
  const identifier =
    typeof record.identifier === "string" ? record.identifier : undefined;
  const url = typeof record.url === "string" ? record.url : undefined;
  const state =
    record.state !== undefined && record.state !== null
      ? requireRecord(record.state, "issue state")
      : undefined;
  const stateSummary =
    state !== undefined
      ? {
          id: typeof state.id === "string" ? state.id.toLowerCase() : undefined,
          ...(typeof state.name === "string" ? { name: state.name } : {}),
          ...(typeof state.type === "string" ? { type: state.type } : {}),
        }
      : undefined;

  return {
    id: typeof record.id === "string" ? record.id.toLowerCase() : undefined,
    ...(identifier !== undefined ? { identifier } : {}),
    ...(title !== undefined ? { title, untrustedContent: true as const } : {}),
    ...(description !== undefined
      ? { description, untrustedContent: true as const }
      : {}),
    ...(team !== undefined ? { team } : {}),
    ...(project !== undefined
      ? {
          project: {
            id: project.id,
            ...(project.name !== undefined ? { name: project.name } : {}),
          },
        }
      : {}),
    ...(stateSummary !== undefined ? { state: stateSummary } : {}),
    ...(typeof record.priority === "number"
      ? { priority: record.priority }
      : {}),
    ...(url !== undefined ? { url } : {}),
    ...(record.createdAt !== undefined ? { createdAt: record.createdAt } : {}),
    ...(record.updatedAt !== undefined ? { updatedAt: record.updatedAt } : {}),
  };
}

export function normalizeCommentRecord(raw: unknown): Record<string, unknown> {
  const record = requireRecord(raw, "comment");
  const body = normalizeOptionalString(
    record.body,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return {
    id: typeof record.id === "string" ? record.id.toLowerCase() : undefined,
    issueId:
      typeof record.issueId === "string"
        ? record.issueId.toLowerCase()
        : undefined,
    ...(body !== undefined ? { body, untrustedContent: true as const } : {}),
    ...(record.createdAt !== undefined ? { createdAt: record.createdAt } : {}),
  };
}

export function normalizeListResponse<TRaw>(
  connection: unknown,
  mapItem: (item: TRaw) => Record<string, unknown>,
): LinearListResult<Record<string, unknown>> {
  const record = requireRecord(connection, "connection");
  const nodes = Array.isArray(record.nodes) ? record.nodes : [];
  const pageInfo = parsePageInfo(record.pageInfo ?? {});
  return {
    nodes: nodes.map((node) => mapItem(node as TRaw)),
    pageInfo,
  };
}

export function formatTeamIdForFilter(teamId: string): string {
  return formatLinearIdForApi(teamId);
}

export function extractIssueTeamId(raw: unknown): string | undefined {
  const normalized = normalizeIssueRecord(raw);
  const team = normalized.team;
  if (
    team !== undefined &&
    team !== null &&
    typeof team === "object" &&
    "id" in team &&
    typeof (team as { id: unknown }).id === "string"
  ) {
    return (team as { id: string }).id;
  }
  return undefined;
}
