import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { LIST_MAX_PER_PAGE, MAX_STAGE_NAME_LENGTH } from "./constants.js";
import { parseSalesforceRecordId } from "./resource-id.js";

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > LIST_MAX_PER_PAGE) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Salesforce list limit is invalid.",
    );
  }
}

export function escapeSoqlLiteral(value: string): string {
  if (value.includes("\0")) {
    throw new ConnectorSdkError("INVALID_INPUT", "SOQL literal is invalid.");
  }
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildWhereClauses(clauses: string[]): string {
  if (clauses.length === 0) return "";
  return ` WHERE ${clauses.join(" AND ")}`;
}

export interface AccountListFilters {
  readonly accountId?: string;
}

export interface ContactListFilters {
  readonly accountId?: string;
}

export interface OpportunityListFilters {
  readonly accountId?: string;
  readonly stage?: string;
  readonly updatedSince?: string;
  readonly closeDateFrom?: string;
  readonly closeDateTo?: string;
}

function parseFilterAccountId(
  raw: string | undefined,
  label: string,
): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  return parseSalesforceRecordId(trimmed, label);
}

function parseFilterStage(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > MAX_STAGE_NAME_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Opportunity stage filter is invalid.",
    );
  }
  if (/[`\n\r]/.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Opportunity stage filter is invalid.",
    );
  }
  return trimmed;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function parseFilterDate(
  raw: string | undefined,
  label: string,
): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (!ISO_DATE.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must be YYYY-MM-DD.`,
    );
  }
  return trimmed;
}

function parseFilterDateTime(
  raw: string | undefined,
  label: string,
): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (ISO_DATE.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }
  if (!ISO_DATETIME.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must be ISO-8601 UTC (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ).`,
    );
  }
  return trimmed;
}

export function normalizeAccountListFilters(
  input: AccountListFilters | undefined,
): Record<string, string | undefined> {
  const accountId = parseFilterAccountId(input?.accountId, "Account id filter");
  return { accountId };
}

export function normalizeContactListFilters(
  input: ContactListFilters | undefined,
): Record<string, string | undefined> {
  const accountId = parseFilterAccountId(input?.accountId, "Account id filter");
  return { accountId };
}

export function normalizeOpportunityListFilters(
  input: OpportunityListFilters | undefined,
): Record<string, string | undefined> {
  return {
    accountId: parseFilterAccountId(input?.accountId, "Account id filter"),
    stage: parseFilterStage(input?.stage),
    updatedSince: parseFilterDateTime(input?.updatedSince, "Updated since"),
    closeDateFrom: parseFilterDate(input?.closeDateFrom, "Close date from"),
    closeDateTo: parseFilterDate(input?.closeDateTo, "Close date to"),
  };
}

export function buildAccountListSoql(
  limit: number,
  filters?: AccountListFilters,
): string {
  assertLimit(limit);
  const normalized = normalizeAccountListFilters(filters);
  const clauses: string[] = [];
  if (normalized.accountId !== undefined) {
    clauses.push(`Id = '${escapeSoqlLiteral(normalized.accountId)}'`);
  }
  return `SELECT Id, Name, Industry, Type, CreatedDate FROM Account${buildWhereClauses(clauses)} ORDER BY CreatedDate DESC LIMIT ${limit}`;
}

export function buildContactListSoql(
  limit: number,
  filters?: ContactListFilters,
): string {
  assertLimit(limit);
  const normalized = normalizeContactListFilters(filters);
  const clauses: string[] = [];
  if (normalized.accountId !== undefined) {
    clauses.push(`AccountId = '${escapeSoqlLiteral(normalized.accountId)}'`);
  }
  return `SELECT Id, Name, AccountId, Title, CreatedDate, Email, Phone FROM Contact${buildWhereClauses(clauses)} ORDER BY CreatedDate DESC LIMIT ${limit}`;
}

export function buildOpportunityListSoql(
  limit: number,
  filters?: OpportunityListFilters,
): string {
  assertLimit(limit);
  const normalized = normalizeOpportunityListFilters(filters);
  const clauses: string[] = [];
  if (normalized.accountId !== undefined) {
    clauses.push(`AccountId = '${escapeSoqlLiteral(normalized.accountId)}'`);
  }
  if (normalized.stage !== undefined) {
    clauses.push(`StageName = '${escapeSoqlLiteral(normalized.stage)}'`);
  }
  if (normalized.updatedSince !== undefined) {
    clauses.push(`LastModifiedDate >= ${normalized.updatedSince}`);
  }
  if (normalized.closeDateFrom !== undefined) {
    clauses.push(`CloseDate >= ${normalized.closeDateFrom}`);
  }
  if (normalized.closeDateTo !== undefined) {
    clauses.push(`CloseDate <= ${normalized.closeDateTo}`);
  }
  return `SELECT Id, Name, AccountId, StageName, Amount, CloseDate, IsClosed, IsWon, LastModifiedDate FROM Opportunity${buildWhereClauses(clauses)} ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
}

export function buildOpportunityStageListSoql(): string {
  return "SELECT Id, ApiName, MasterLabel, IsActive, IsClosed, IsWon, SortOrder FROM OpportunityStage WHERE IsActive = true ORDER BY SortOrder";
}
