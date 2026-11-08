import { LIST_DEFAULT_PER_PAGE, OUTPUT_MAX_NAME_LENGTH } from "./constants.js";
import { coerceZohoIdField } from "./resource-id.js";

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

function readId(row: Record<string, unknown>): string {
  const fromId = coerceZohoIdField(row.id);
  if (fromId !== undefined) return fromId;
  return "";
}

function extractDataArray(raw: unknown): unknown[] {
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { data?: unknown }).data)
  ) {
    return (raw as { data: unknown[] }).data;
  }
  return Array.isArray(raw) ? raw : [];
}

function readMoreRecords(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const info = (raw as { info?: unknown }).info;
  if (typeof info !== "object" || info === null) return false;
  const more = (info as { more_records?: unknown }).more_records;
  return more === true;
}

function normalizeRecordSummary(
  raw: unknown,
  includePii: boolean,
  nameKey: string,
  emailKey?: string,
) {
  const row =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const name = readString(row, nameKey);
  const email =
    emailKey !== undefined && includePii
      ? readString(row, emailKey)
      : emailKey !== undefined
        ? "[REDACTED_EMAIL]"
        : undefined;
  return {
    id: readId(row),
    ...(name !== undefined
      ? { name: truncate(name, OUTPUT_MAX_NAME_LENGTH) }
      : {}),
    ...(email !== undefined ? { email } : {}),
    untrustedFields: row,
  };
}

export function mapRecordListResponse(
  moduleLabel: string,
  raw: unknown,
  page: number,
  perPage: number,
  includePii: boolean,
  nameKey: string,
  emailKey?: string,
) {
  const records = extractDataArray(raw).map((item) =>
    normalizeRecordSummary(item, includePii, nameKey, emailKey),
  );
  const more = readMoreRecords(raw);
  const hasMore =
    more || records.length >= perPage
      ? { hasMore: more || records.length >= perPage }
      : { hasMore: false };
  return {
    module: moduleLabel,
    pageInfo: {
      page,
      ...hasMore,
      ...(more || records.length >= perPage ? { nextPage: page + 1 } : {}),
    },
    records,
    untrustedContent: true as const,
  };
}

export function mapRecordGetResponse(
  moduleLabel: string,
  raw: unknown,
  includePii: boolean,
  nameKey: string,
  emailKey?: string,
) {
  const row =
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: unknown[] }).data[0] ?? raw)
      : raw;
  return {
    module: moduleLabel,
    record: normalizeRecordSummary(row, includePii, nameKey, emailKey),
    untrustedContent: true as const,
  };
}

export function mapDealStageListResponse(raw: unknown) {
  const fields =
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { fields?: unknown }).fields)
      ? (raw as { fields: unknown[] }).fields
      : [];
  const stageField = fields.find((field) => {
    if (typeof field !== "object" || field === null) return false;
    const apiName = (field as { api_name?: unknown }).api_name;
    return apiName === "Stage";
  });
  const pickList =
    typeof stageField === "object" &&
    stageField !== null &&
    Array.isArray(
      (stageField as { pick_list_values?: unknown }).pick_list_values,
    )
      ? ((stageField as { pick_list_values: unknown[] }).pick_list_values ?? [])
      : [];
  const stages = pickList
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return undefined;
      const display = (entry as { display_value?: unknown }).display_value;
      const actual = (entry as { actual_value?: unknown }).actual_value;
      const value =
        typeof actual === "string"
          ? actual
          : typeof display === "string"
            ? display
            : undefined;
      return value;
    })
    .filter((v): v is string => v !== undefined);
  return { stages, untrustedContent: true as const };
}

export function readDealIdFromRecord(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  return readId(raw as Record<string, unknown>);
}

export const ZOHO_MODULE_FIELDS = {
  Leads: { nameKey: "Last_Name", emailKey: "Email" },
  Accounts: { nameKey: "Account_Name", emailKey: undefined },
  Contacts: { nameKey: "Last_Name", emailKey: "Email" },
  Deals: { nameKey: "Deal_Name", emailKey: undefined },
} as const;

export { LIST_DEFAULT_PER_PAGE };
