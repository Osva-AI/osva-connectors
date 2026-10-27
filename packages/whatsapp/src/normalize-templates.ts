import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return normalized.value.length > 0 ? normalized.value : null;
}

export function mapTemplateRow(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp returned an unexpected template row.",
    );
  }
  const row = raw as Record<string, unknown>;
  return {
    templateId: readString(row.id),
    name: readString(row.name),
    language: readString(row.language),
    status: readString(row.status),
    category: readString(row.category),
  };
}

export function mapTemplateListResponse(
  rows: readonly unknown[],
  context: { nextCursor?: string; pagesFetched: number },
): Record<string, unknown> {
  const mapped = rows.map(mapTemplateRow);
  const envelope = {
    provenance: {
      source: "whatsapp.business_management_api",
      edge: "message_templates",
      pagesFetched: context.pagesFetched,
      untrustedProviderText: true as const,
    },
    ...(context.nextCursor !== undefined
      ? { nextCursor: context.nextCursor }
      : {}),
  };
  const packed = packListWithinOutputBudget(envelope, "templates", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapTemplateGetResponse(
  raw: unknown,
  templateId: string,
): Record<string, unknown> {
  const row = mapTemplateRow({ ...(raw as object), id: templateId });
  const payload = {
    provenance: {
      source: "whatsapp.business_management_api",
      untrustedProviderText: true as const,
    },
    ...row,
    templateId,
    components: Array.isArray((raw as Record<string, unknown>).components)
      ? ((raw as Record<string, unknown>).components as unknown[]).slice(0, 20)
      : [],
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

export function extractTemplateMetadata(raw: unknown): {
  status: string | null;
  category: string | null;
  language: string | null;
  components: unknown;
} {
  if (raw === null || typeof raw !== "object") {
    return {
      status: null,
      category: null,
      language: null,
      components: [],
    };
  }
  const row = raw as Record<string, unknown>;
  return {
    status: readString(row.status),
    category: readString(row.category),
    language: readString(row.language),
    components: row.components ?? [],
  };
}

export function mapTemplateSendResponse(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp returned an unexpected send response.",
    );
  }
  const row = raw as Record<string, unknown>;
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const first =
    messages.length > 0 && typeof messages[0] === "object"
      ? (messages[0] as Record<string, unknown>)
      : undefined;
  const messageId = first !== undefined ? readString(first.id) : null;

  const payload = {
    provenance: {
      source: "whatsapp.cloud_api",
      edge: "messages",
      deliveryStatus: "unknown" as const,
      note: "Acceptance by WhatsApp does not confirm delivery. Use signed webhooks for delivery and read receipts.",
    },
    whatsAppMessageId: messageId,
    messagingProduct: readString(row.messaging_product),
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}
