import { LIST_DEFAULT_PER_PAGE, OUTPUT_MAX_NAME_LENGTH } from "./constants.js";

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function readString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function readId(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  const id =
    (raw as { Id?: unknown; id?: unknown }).Id ?? (raw as { id?: unknown }).id;
  return id === undefined ? "" : String(id);
}

function extractQueryRecords(raw: unknown): unknown[] {
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { records?: unknown }).records)
  ) {
    return (raw as { records: unknown[] }).records;
  }
  return [];
}

function redactPiiFields(
  row: Record<string, unknown>,
  includePii: boolean,
): Record<string, unknown> {
  if (includePii) return row;
  const out = { ...row };
  for (const key of [
    "Email",
    "Phone",
    "MobilePhone",
    "HomePhone",
    "OtherPhone",
  ]) {
    if (key in out) {
      out[key] = "[REDACTED]";
    }
  }
  return out;
}

function normalizeRecordSummary(
  raw: unknown,
  includePii: boolean,
): Record<string, unknown> {
  const row =
    typeof raw === "object" && raw !== null
      ? redactPiiFields(raw as Record<string, unknown>, includePii)
      : {};
  const name =
    readString(row, "Name") ??
    [readString(row, "FirstName"), readString(row, "LastName")]
      .filter(Boolean)
      .join(" ");
  return {
    id: readId(row),
    ...(name !== undefined && name.length > 0
      ? { name: truncate(name, OUTPUT_MAX_NAME_LENGTH) }
      : {}),
    ...row,
  };
}

function readQueryDone(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return true;
  const done = (raw as { done?: unknown }).done;
  return done !== false;
}

function readTotalSize(raw: unknown): number | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const total = (raw as { totalSize?: unknown }).totalSize;
  return typeof total === "number" && Number.isFinite(total)
    ? total
    : undefined;
}

export function mapQueryListResponse(
  raw: unknown,
  includePii: boolean,
  collectionKey: string,
  continuationToken?: string,
) {
  const records = extractQueryRecords(raw).map((r) =>
    normalizeRecordSummary(r, includePii),
  );
  const done = readQueryDone(raw);
  const totalSize = readTotalSize(raw);
  const pageInfo: Record<string, unknown> = {
    hasMore: !done,
    ...(totalSize !== undefined ? { totalSize } : {}),
    ...(continuationToken !== undefined
      ? { continuationToken }
      : done
        ? {}
        : {}),
  };
  if (done && continuationToken === undefined) {
    pageInfo.hasMore = false;
  }
  return {
    pageInfo,
    [collectionKey]: records,
    untrustedContent: true as const,
  };
}

export function mapRecordGetResponse(
  raw: unknown,
  includePii: boolean,
  singularKey: string,
) {
  const record =
    typeof raw === "object" && raw !== null
      ? normalizeRecordSummary(raw, includePii)
      : {};
  return {
    [singularKey]: record,
    untrustedContent: true as const,
  };
}

export function mapOpportunityStageListResponse(raw: unknown) {
  const stages = extractQueryRecords(raw).map((row) => {
    const record =
      typeof row === "object" && row !== null
        ? (row as Record<string, unknown>)
        : {};
    return {
      masterLabel: readString(record, "MasterLabel"),
      apiName: readString(record, "ApiName"),
      isActive: record.IsActive === true,
      isClosed: record.IsClosed === true,
      isWon: record.IsWon === true,
      sortOrder:
        typeof record.SortOrder === "number" ? record.SortOrder : undefined,
    };
  });
  return {
    pageInfo: { page: 1, hasMore: false },
    stages,
    untrustedContent: true as const,
  };
}

export function defaultListPerPage(perPage: number | undefined): number {
  return perPage ?? LIST_DEFAULT_PER_PAGE;
}

export function splitQueryResponseEnvelope(raw: unknown): {
  readonly body: unknown;
  readonly continuationToken?: string;
} {
  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    if ("__continuationToken" in record) {
      const { __continuationToken, ...rest } = record;
      return {
        body: rest,
        continuationToken:
          typeof __continuationToken === "string"
            ? __continuationToken
            : undefined,
      };
    }
  }
  return { body: raw };
}
