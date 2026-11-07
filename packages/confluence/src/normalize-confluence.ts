import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { parseConfluenceId } from "./confluence-id.js";
import {
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";

export interface NormalizedSpace {
  readonly id: string;
  readonly key?: string;
  readonly name?: string;
  readonly type?: string;
  readonly status?: string;
  readonly untrustedContent: true;
}

export interface NormalizedPageSummary {
  readonly id: string;
  readonly spaceId?: string;
  readonly parentId?: string;
  readonly title?: string;
  readonly status?: string;
  readonly createdAt?: string;
  readonly version?: number;
  readonly untrustedContent: true;
}

export interface NormalizedPageDetail extends NormalizedPageSummary {
  readonly bodyStorage?: {
    readonly value: string;
    readonly truncated: boolean;
  };
}

export interface NormalizedSearchHit {
  readonly id: string;
  readonly type?: string;
  readonly spaceId?: string;
  readonly title?: string;
  readonly excerpt?: string;
  readonly excerptTruncated?: true;
  readonly url?: string;
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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extractSpaceId(record: Record<string, unknown>): string | undefined {
  const spaceId = optionalString(record.spaceId);
  if (spaceId !== undefined) {
    return parseConfluenceId(spaceId, "space ID");
  }
  const space = record.space;
  if (space !== null && typeof space === "object") {
    const id = optionalString((space as Record<string, unknown>).id);
    if (id !== undefined) {
      return parseConfluenceId(id, "space ID");
    }
  }
  const spaceKey = record.spaceKey;
  return optionalString(spaceKey);
}

export function normalizeSpaceRecord(raw: unknown): NormalizedSpace {
  const record = requireRecord(
    raw,
    "Confluence returned an unexpected space payload.",
  );
  const idRaw = record.id;
  if (typeof idRaw !== "string" && typeof idRaw !== "number") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence returned an unexpected space payload.",
    );
  }
  const id = parseConfluenceId(String(idRaw), "space ID");
  const nameRaw = optionalString(record.name);
  const name =
    nameRaw !== undefined
      ? normalizeTruncatableProviderString(
          nameRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;
  return {
    id,
    ...(optionalString(record.key) !== undefined
      ? { key: optionalString(record.key) }
      : {}),
    ...(name !== undefined ? { name, untrustedContent: true as const } : {}),
    ...(optionalString(record.type) !== undefined
      ? { type: optionalString(record.type) }
      : {}),
    ...(optionalString(record.status) !== undefined
      ? { status: optionalString(record.status) }
      : {}),
    untrustedContent: true as const,
  };
}

export function normalizePageSummary(raw: unknown): NormalizedPageSummary {
  const record = requireRecord(
    raw,
    "Confluence returned an unexpected page payload.",
  );
  const idRaw = record.id;
  if (typeof idRaw !== "string" && typeof idRaw !== "number") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence returned an unexpected page payload.",
    );
  }
  const id = parseConfluenceId(String(idRaw), "page ID");
  const titleRaw = optionalString(record.title);
  const title =
    titleRaw !== undefined
      ? normalizeTruncatableProviderString(
          titleRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;

  let version: number | undefined;
  const versionObj = record.version;
  if (versionObj !== null && typeof versionObj === "object") {
    const number = (versionObj as Record<string, unknown>).number;
    if (typeof number === "number" && Number.isInteger(number)) {
      version = number;
    }
  }

  const parentIdRaw =
    optionalString(record.parentId) ??
    (record.parent !== null && typeof record.parent === "object"
      ? optionalString((record.parent as Record<string, unknown>).id)
      : undefined);

  return {
    id,
    ...(extractSpaceId(record) !== undefined
      ? { spaceId: extractSpaceId(record) }
      : {}),
    ...(parentIdRaw !== undefined
      ? { parentId: parseConfluenceId(parentIdRaw, "parent page ID") }
      : {}),
    ...(title !== undefined ? { title, untrustedContent: true as const } : {}),
    ...(optionalString(record.status) !== undefined
      ? { status: optionalString(record.status) }
      : {}),
    ...(optionalString(record.createdAt) !== undefined
      ? { createdAt: optionalString(record.createdAt) }
      : {}),
    ...(version !== undefined ? { version } : {}),
    untrustedContent: true as const,
  };
}

export function normalizePageDetail(raw: unknown): NormalizedPageDetail {
  const summary = normalizePageSummary(raw);
  const record = requireRecord(
    raw,
    "Confluence returned an unexpected page payload.",
  );
  const body = record.body;
  if (body === null || typeof body !== "object") {
    return summary;
  }
  const bodyRecord = body as Record<string, unknown>;
  const representation = optionalString(bodyRecord.representation);
  const valueRaw = optionalString(bodyRecord.value);
  if (representation !== "storage" || valueRaw === undefined) {
    return summary;
  }
  const truncated = normalizeTruncatableProviderString(
    valueRaw,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return {
    ...summary,
    bodyStorage: {
      value: truncated.value,
      truncated: truncated.truncated,
    },
  };
}

export function normalizeSearchHit(raw: unknown): NormalizedSearchHit {
  const record = requireRecord(
    raw,
    "Confluence returned an unexpected search result.",
  );

  const content = record.content;
  const contentRecord =
    content !== null && typeof content === "object"
      ? (content as Record<string, unknown>)
      : record;

  const idRaw = contentRecord.id ?? record.id;
  if (typeof idRaw !== "string" && typeof idRaw !== "number") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence returned an unexpected search result.",
    );
  }
  const id = parseConfluenceId(String(idRaw), "content ID");

  const titleRaw =
    optionalString(contentRecord.title) ?? optionalString(record.title);
  const title =
    titleRaw !== undefined
      ? normalizeTruncatableProviderString(
          titleRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;

  const excerptRaw = optionalString(record.excerpt);
  const excerptResult =
    excerptRaw !== undefined
      ? normalizeTruncatableProviderString(
          excerptRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;

  return {
    id,
    ...(optionalString(contentRecord.type) !== undefined
      ? { type: optionalString(contentRecord.type) }
      : {}),
    ...(extractSpaceId(record) !== undefined ||
    extractSpaceId(contentRecord) !== undefined
      ? {
          spaceId: extractSpaceId(record) ?? extractSpaceId(contentRecord),
        }
      : {}),
    ...(title !== undefined ? { title, untrustedContent: true as const } : {}),
    ...(excerptResult !== undefined
      ? {
          excerpt: excerptResult.value,
          ...(excerptResult.truncated
            ? { excerptTruncated: true as const }
            : {}),
        }
      : {}),
    ...(optionalString(record.url) !== undefined
      ? { url: optionalString(record.url) }
      : {}),
    untrustedContent: true as const,
  };
}
