import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { NotionConfig } from "./schemas.js";
import {
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";
import {
  normalizeRichTextField,
  richTextPlainFromProperty,
} from "./rich-text.js";
import { formatNotionIdForApi, parseNotionId } from "./notion-id.js";

export interface NormalizedNotionObject {
  readonly id: string;
  readonly object: string;
  readonly inTrash?: boolean;
  readonly url?: string;
  readonly createdTime?: string;
  readonly lastEditedTime?: string;
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

function normalizeEssentialId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Notion returned an unexpected payload.",
    );
  }
  return parseNotionId(value, "Notion ID");
}

function mapBaseFields(
  record: Record<string, unknown>,
): NormalizedNotionObject {
  const id = formatNotionIdForApi(normalizeEssentialId(record.id));
  const object = typeof record.object === "string" ? record.object : "unknown";
  return {
    id,
    object,
    ...(record.in_trash === true || record.archived === true
      ? { inTrash: true as const }
      : {}),
    ...(typeof record.url === "string" ? { url: record.url } : {}),
    ...(typeof record.created_time === "string"
      ? { createdTime: record.created_time }
      : {}),
    ...(typeof record.last_edited_time === "string"
      ? { lastEditedTime: record.last_edited_time }
      : {}),
    untrustedContent: true as const,
  };
}

function normalizePropertyValue(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (type === "title" || type === "rich_text") {
    const rich = record[type];
    const normalized = normalizeRichTextField(rich);
    return {
      type,
      ...(normalized !== undefined ? { richText: normalized } : {}),
    };
  }
  if (
    type === "select" &&
    record.select !== null &&
    typeof record.select === "object"
  ) {
    const select = record.select as Record<string, unknown>;
    const name =
      typeof select.name === "string"
        ? normalizeTruncatableProviderString(
            select.name,
            OUTPUT_MAX_PROVIDER_STRING_LENGTH,
          ).value
        : undefined;
    return {
      type,
      ...(name !== undefined ? { name, untrustedContent: true as const } : {}),
    };
  }
  if (type === "multi_select" && Array.isArray(record.multi_select)) {
    const names = record.multi_select
      .map((entry) => {
        if (entry !== null && typeof entry === "object") {
          const name = (entry as Record<string, unknown>).name;
          if (typeof name === "string") {
            return normalizeTruncatableProviderString(
              name,
              OUTPUT_MAX_PROVIDER_STRING_LENGTH,
            ).value;
          }
        }
        return undefined;
      })
      .filter((n): n is string => n !== undefined);
    return { type, names, untrustedContent: true as const };
  }
  if (type === "number" && typeof record.number === "number") {
    return { type, number: record.number };
  }
  if (type === "checkbox" && typeof record.checkbox === "boolean") {
    return { type, checkbox: record.checkbox };
  }
  if (type === "url" && typeof record.url === "string") {
    const normalized = normalizeTruncatableProviderString(
      record.url,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
    return {
      type,
      url: normalized.value,
      untrustedContent: true as const,
      ...(normalized.truncated ? { urlTruncated: true as const } : {}),
    };
  }
  if (
    type === "date" &&
    record.date !== null &&
    typeof record.date === "object"
  ) {
    const date = record.date as Record<string, unknown>;
    return {
      type,
      start: date.start,
      end: date.end,
      timeZone: date.time_zone,
    };
  }
  return { type: String(type), raw: record };
}

export function normalizePageRecord(raw: unknown): Record<string, unknown> {
  const record = requireRecord(
    raw,
    "Notion returned an unexpected page payload.",
  );
  const base = mapBaseFields(record);
  const properties =
    record.properties !== null && typeof record.properties === "object"
      ? (record.properties as Record<string, unknown>)
      : {};
  const normalizedProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    const propName = normalizeTruncatableProviderString(key, 256).value;
    normalizedProperties[propName] = normalizePropertyValue(value);
  }
  let title: string | undefined;
  for (const value of Object.values(properties)) {
    if (value !== null && typeof value === "object") {
      const typed = value as Record<string, unknown>;
      if (typed.type === "title") {
        title = richTextPlainFromProperty(typed.title);
        break;
      }
    }
  }
  return {
    ...base,
    ...(title !== undefined
      ? {
          title: {
            plain: title,
            untrustedContent: true as const,
          },
        }
      : {}),
    properties: normalizedProperties,
  };
}

function normalizeBlockRecord(
  raw: unknown,
  depth: number,
  maxDepth: number,
): Record<string, unknown> {
  const record = requireRecord(
    raw,
    "Notion returned an unexpected block payload.",
  );
  const base = mapBaseFields(record);
  const type = typeof record.type === "string" ? record.type : "unsupported";
  const typePayload = record[type];
  let content: unknown;
  if (
    type === "paragraph" ||
    type === "heading_1" ||
    type === "heading_2" ||
    type === "heading_3" ||
    type === "bulleted_list_item" ||
    type === "numbered_list_item" ||
    type === "quote" ||
    type === "callout"
  ) {
    if (typePayload !== null && typeof typePayload === "object") {
      const payload = typePayload as Record<string, unknown>;
      const richText = normalizeRichTextField(payload.rich_text);
      content = {
        ...(richText !== undefined ? { richText } : {}),
      };
    }
  } else if (
    type === "meeting_notes" &&
    typePayload !== null &&
    typeof typePayload === "object"
  ) {
    const payload = typePayload as Record<string, unknown>;
    const richText = normalizeRichTextField(payload.rich_text);
    const title =
      typeof payload.title === "string"
        ? normalizeTruncatableProviderString(
            payload.title,
            OUTPUT_MAX_PROVIDER_STRING_LENGTH,
          )
        : undefined;
    content = {
      ...(richText !== undefined ? { richText } : {}),
      ...(title !== undefined
        ? {
            title: title.value,
            untrustedContent: true as const,
            ...(title.truncated ? { titleTruncated: true as const } : {}),
          }
        : {}),
    };
  } else if (
    type === "transcription" &&
    typePayload !== null &&
    typeof typePayload === "object"
  ) {
    content = { legacyBlockType: "transcription" as const };
  } else if (
    type === "child_page" &&
    typePayload !== null &&
    typeof typePayload === "object"
  ) {
    const title = (typePayload as Record<string, unknown>).title;
    if (typeof title === "string") {
      const normalized = normalizeTruncatableProviderString(
        title,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      );
      content = {
        title: normalized.value,
        untrustedContent: true as const,
        ...(normalized.truncated ? { titleTruncated: true as const } : {}),
      };
    }
  }

  const hasChildren = record.has_children === true;
  const childrenDepthExceeded = depth >= maxDepth;

  return {
    ...base,
    blockType: type,
    ...(content !== undefined ? { content } : {}),
    ...(hasChildren ? { hasChildren: true as const } : {}),
    ...(childrenDepthExceeded && hasChildren
      ? { nestedChildrenOmitted: true as const }
      : {}),
  };
}

export function normalizeBlockList(
  items: readonly unknown[],
  config: Pick<NotionConfig, "maxBlockDepth">,
  depth = 0,
): Record<string, unknown>[] {
  return items.map((item) =>
    normalizeBlockRecord(item, depth, config.maxBlockDepth),
  );
}

export function normalizeDatabaseRecord(raw: unknown): Record<string, unknown> {
  const record = requireRecord(
    raw,
    "Notion returned an unexpected database payload.",
  );
  const base = mapBaseFields(record);
  const titleRich = normalizeRichTextField(record.title);
  const dataSources = Array.isArray(record.data_sources)
    ? record.data_sources
        .map((entry) => {
          if (entry === null || typeof entry !== "object") {
            return undefined;
          }
          const ds = entry as Record<string, unknown>;
          if (typeof ds.id !== "string") {
            return undefined;
          }
          return {
            id: formatNotionIdForApi(parseNotionId(ds.id, "data source ID")),
            ...(typeof ds.name === "string"
              ? {
                  name: normalizeTruncatableProviderString(
                    ds.name,
                    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
                  ).value,
                  untrustedContent: true as const,
                }
              : {}),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== undefined)
    : [];
  return {
    ...base,
    ...(titleRich !== undefined ? { title: titleRich } : {}),
    ...(dataSources.length > 0 ? { dataSources } : {}),
    note: "Database IDs and data source IDs are distinct. Use notion.datasource.get/query with a data source ID from this record.",
  };
}

export function normalizeDataSourceRecord(
  raw: unknown,
): Record<string, unknown> {
  const record = requireRecord(
    raw,
    "Notion returned an unexpected data source payload.",
  );
  const base = mapBaseFields(record);
  const titleRich = normalizeRichTextField(record.title);
  const databaseParent =
    record.database_parent !== null &&
    typeof record.database_parent === "object"
      ? (record.database_parent as Record<string, unknown>)
      : undefined;
  const parentDatabaseId =
    databaseParent !== undefined &&
    typeof databaseParent.database_id === "string"
      ? formatNotionIdForApi(
          parseNotionId(databaseParent.database_id, "database ID"),
        )
      : undefined;
  return {
    ...base,
    ...(titleRich !== undefined ? { title: titleRich } : {}),
    ...(parentDatabaseId !== undefined ? { parentDatabaseId } : {}),
  };
}

export function normalizeSearchResultItem(
  raw: unknown,
): Record<string, unknown> {
  const record = requireRecord(
    raw,
    "Notion returned an unexpected search item.",
  );
  const object = typeof record.object === "string" ? record.object : "unknown";
  if (object === "page") {
    return normalizePageRecord(record);
  }
  if (object === "database") {
    return normalizeDatabaseRecord(record);
  }
  if (object === "data_source") {
    return normalizeDataSourceRecord(record);
  }
  return { ...mapBaseFields(record) };
}
