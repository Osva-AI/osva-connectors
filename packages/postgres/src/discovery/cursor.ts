import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { z } from "zod";

const schemaCursorSchema = z
  .object({
    v: z.literal(1),
    kind: z.literal("schema"),
    after: z.string().max(128),
  })
  .strict();

const tableCursorSchema = z
  .object({
    v: z.literal(1),
    kind: z.literal("table"),
    schema: z.string().max(128),
    after: z.string().max(128),
  })
  .strict();

const columnCursorSchema = z
  .object({
    v: z.literal(1),
    kind: z.literal("column"),
    schema: z.string().max(128),
    table: z.string().max(128),
    afterOrdinal: z.number().int().min(0).max(32_767),
  })
  .strict();

function decodeCursorPayload(raw: string): unknown {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json) as unknown;
  } catch {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination cursor is invalid.",
    );
  }
}

export function encodeSchemaCursor(after: string): string {
  const payload = { v: 1 as const, kind: "schema" as const, after };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parseSchemaCursor(raw: string | undefined): string {
  if (raw === undefined || raw.trim().length === 0) {
    return "";
  }
  const parsed = schemaCursorSchema.safeParse(decodeCursorPayload(raw.trim()));
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination cursor is invalid.",
    );
  }
  return parsed.data.after;
}

export function encodeTableCursor(schema: string, after: string): string {
  const payload = { v: 1 as const, kind: "table" as const, schema, after };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parseTableCursor(
  raw: string | undefined,
  expectedSchema: string,
): string {
  if (raw === undefined || raw.trim().length === 0) {
    return "";
  }
  const parsed = tableCursorSchema.safeParse(decodeCursorPayload(raw.trim()));
  if (!parsed.success || parsed.data.schema !== expectedSchema) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination cursor is invalid.",
    );
  }
  return parsed.data.after;
}

export function encodeColumnCursor(
  schema: string,
  table: string,
  afterOrdinal: number,
): string {
  const payload = {
    v: 1 as const,
    kind: "column" as const,
    schema,
    table,
    afterOrdinal,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parseColumnCursor(
  raw: string | undefined,
  expectedSchema: string,
  expectedTable: string,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return 0;
  }
  const parsed = columnCursorSchema.safeParse(decodeCursorPayload(raw.trim()));
  if (
    !parsed.success ||
    parsed.data.schema !== expectedSchema ||
    parsed.data.table !== expectedTable
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination cursor is invalid.",
    );
  }
  return parsed.data.afterOrdinal;
}
