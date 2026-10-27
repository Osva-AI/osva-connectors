import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

const ALLOWED_EVENT_ATTRIBUTE_KEYS = new Set(["datetime", "timestamp", "uuid"]);

function normalizeEventResource(resource: unknown): Record<string, unknown> {
  const record = asRecord(resource);
  if (record === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo returned an unexpected event payload.",
    );
  }
  const type =
    typeof record.type === "string"
      ? normalizeEssentialProviderString(
          record.type,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const id =
    typeof record.id === "string"
      ? normalizeEssentialProviderString(
          record.id,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const attributes = asRecord(record.attributes) ?? {};
  const safeAttributes: Record<string, unknown> = {};
  for (const key of ALLOWED_EVENT_ATTRIBUTE_KEYS) {
    if (!(key in attributes)) {
      continue;
    }
    const value = attributes[key];
    if (typeof value === "string") {
      safeAttributes[key] = normalizeTruncatableProviderString(
        value,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      safeAttributes[key] = value;
    }
  }
  return {
    ...(type !== undefined ? { type } : {}),
    ...(id !== undefined ? { id } : {}),
    attributes: safeAttributes,
  };
}

function normalizeJsonApiResource(resource: unknown): Record<string, unknown> {
  const record = asRecord(resource);
  if (record === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo returned an unexpected resource payload.",
    );
  }
  const type =
    typeof record.type === "string"
      ? normalizeEssentialProviderString(
          record.type,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const id =
    typeof record.id === "string"
      ? normalizeEssentialProviderString(
          record.id,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const attributes = asRecord(record.attributes) ?? {};
  const normalizedAttributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === "string") {
      normalizedAttributes[key] = normalizeTruncatableProviderString(
        value,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
    } else {
      normalizedAttributes[key] = value;
    }
  }
  return {
    ...(type !== undefined ? { type } : {}),
    ...(id !== undefined ? { id } : {}),
    attributes: normalizedAttributes,
  };
}

export function mapAccountGetResponse(raw: unknown): unknown {
  const record = asRecord(raw);
  const data = record?.data;
  const items = Array.isArray(data)
    ? data.map(normalizeJsonApiResource)
    : data !== undefined
      ? [normalizeJsonApiResource(data)]
      : [];
  const result = packListWithinOutputBudget(
    { kind: "account" as const },
    "accounts",
    items,
  );
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapResourceListResponse(
  kind: "campaign" | "flow" | "metric" | "event",
  raw: unknown,
  pagination: {
    readonly nextCursor?: string;
    readonly rowsTruncated?: boolean;
  },
): unknown {
  const normalizeRow =
    kind === "event" ? normalizeEventResource : normalizeJsonApiResource;
  const rows = Array.isArray((asRecord(raw) ?? {}).data)
    ? ((asRecord(raw) ?? {}).data as unknown[]).map(normalizeRow)
    : [];
  const envelope = {
    kind,
    ...(pagination.nextCursor !== undefined
      ? { nextCursor: pagination.nextCursor }
      : {}),
    ...(pagination.rowsTruncated === true
      ? { rowsTruncated: true as const }
      : {}),
  };
  const key =
    kind === "campaign"
      ? ("campaigns" as const)
      : kind === "flow"
        ? ("flows" as const)
        : kind === "metric"
          ? ("metrics" as const)
          : ("events" as const);
  const result = packListWithinOutputBudget(envelope, key, rows);
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapResourceGetResponse(
  kind: "campaign" | "flow" | "metric",
  raw: unknown,
): unknown {
  const record = asRecord(raw);
  const data = record?.data;
  const resource = normalizeJsonApiResource(data);
  const result = { kind, resource };
  assertStructuredOutputWithinBudget(result);
  return result;
}
