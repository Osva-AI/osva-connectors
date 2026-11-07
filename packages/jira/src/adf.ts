import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./output-budget.js";

export interface AtlassianDocumentFormat {
  readonly type: "doc";
  readonly version: 1;
  readonly content: readonly unknown[];
}

export function plainTextToAdf(text: string): AtlassianDocumentFormat {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "ADF text body must be non-empty.",
    );
  }
  if ([...trimmed].length > OUTPUT_MAX_PROVIDER_STRING_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "ADF text body exceeds maximum length.",
    );
  }
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: trimmed }],
      },
    ],
  };
}

export function adfPlainText(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (record.type !== "doc" || !Array.isArray(record.content)) {
    return undefined;
  }
  const parts: string[] = [];
  function walk(nodes: unknown[]): void {
    for (const node of nodes) {
      if (node === null || typeof node !== "object") {
        continue;
      }
      const n = node as Record<string, unknown>;
      if (n.type === "text" && typeof n.text === "string") {
        parts.push(n.text);
      }
      if (Array.isArray(n.content)) {
        walk(n.content);
      }
    }
  }
  walk(record.content);
  const joined = parts.join("").trim();
  return joined.length > 0 ? joined : undefined;
}
