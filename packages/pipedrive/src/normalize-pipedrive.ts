import {
  LIST_DEFAULT_LIMIT,
  OUTPUT_MAX_NAME_LENGTH,
  OUTPUT_MAX_TITLE_LENGTH,
} from "./constants.js";
import {
  extractPipedriveDataRows,
  extractPipedriveEntity,
  extractPipedriveNextCursor,
} from "./pipedrive-rest-client.js";

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function readId(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)
    : {};
}

export function mapPipelineListResponse(raw: unknown) {
  const pipelines = extractPipedriveDataRows(raw).map((row) => {
    const record = asRecord(row);
    return {
      id: readId(record, "id"),
      name: truncate(readString(record, "name") ?? "", OUTPUT_MAX_NAME_LENGTH),
      orderNr: readId(record, "order_nr"),
      active: record.active === true,
    };
  });
  const nextCursor = extractPipedriveNextCursor(raw);
  return {
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: pipelines.length >= LIST_DEFAULT_LIMIT }),
    },
    pipelines,
    untrustedContent: true as const,
  };
}

export function mapStageListResponse(raw: unknown) {
  const stages = extractPipedriveDataRows(raw).map((row) => {
    const record = asRecord(row);
    return {
      id: readId(record, "id"),
      name: truncate(readString(record, "name") ?? "", OUTPUT_MAX_NAME_LENGTH),
      pipelineId: readId(record, "pipeline_id"),
      orderNr: readId(record, "order_nr"),
    };
  });
  const nextCursor = extractPipedriveNextCursor(raw);
  return {
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: stages.length >= LIST_DEFAULT_LIMIT }),
    },
    stages,
    untrustedContent: true as const,
  };
}

export function mapDealListResponse(
  raw: unknown,
  nextCursor: string | undefined,
) {
  const deals = extractPipedriveDataRows(raw).map((row) =>
    normalizeDealSummary(asRecord(row)),
  );
  return {
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: deals.length >= LIST_DEFAULT_LIMIT }),
    },
    deals,
    untrustedContent: true as const,
  };
}

export function mapDealGetResponse(raw: unknown) {
  const deal = asRecord(extractPipedriveEntity(raw));
  return {
    deal: normalizeDealDetail(deal),
    untrustedContent: true as const,
  };
}

export function mapDealSearchResponse(raw: unknown) {
  const deals = extractPipedriveDataRows(raw).map((row) =>
    normalizeDealSummary(asRecord(row)),
  );
  const nextCursor = extractPipedriveNextCursor(raw);
  return {
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: false }),
    },
    deals,
    untrustedContent: true as const,
  };
}

export function mapPersonListResponse(
  raw: unknown,
  nextCursor: string | undefined,
  includePii: boolean,
) {
  const persons = extractPipedriveDataRows(raw).map((row) =>
    normalizePerson(asRecord(row), includePii),
  );
  return {
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: persons.length >= LIST_DEFAULT_LIMIT }),
    },
    persons,
    untrustedContent: true as const,
  };
}

export function mapPersonGetResponse(raw: unknown, includePii: boolean) {
  const person = asRecord(extractPipedriveEntity(raw));
  return {
    person: normalizePerson(person, includePii),
    untrustedContent: true as const,
  };
}

export function mapOrganizationListResponse(
  raw: unknown,
  nextCursor: string | undefined,
  includePii: boolean,
) {
  const organizations = extractPipedriveDataRows(raw).map((row) =>
    normalizeOrganization(asRecord(row), includePii),
  );
  return {
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: organizations.length >= LIST_DEFAULT_LIMIT }),
    },
    organizations,
    untrustedContent: true as const,
  };
}

export function mapOrganizationGetResponse(raw: unknown, includePii: boolean) {
  const organization = asRecord(extractPipedriveEntity(raw));
  return {
    organization: normalizeOrganization(organization, includePii),
    untrustedContent: true as const,
  };
}

export function mapDealStageSetResponse(dealId: number, targetStageId: number) {
  return {
    dealId,
    targetStageId,
    updated: true as const,
  };
}

function normalizeDealSummary(
  deal: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: readId(deal, "id"),
    title: truncate(readString(deal, "title") ?? "", OUTPUT_MAX_TITLE_LENGTH),
    status: readString(deal, "status"),
    stageId: readId(deal, "stage_id"),
    pipelineId: readId(deal, "pipeline_id"),
    personId: readId(deal, "person_id"),
    orgId: readId(deal, "org_id"),
    ownerId: readId(deal, "owner_id"),
    value: deal.value,
    currency: readString(deal, "currency"),
    addTime: readString(deal, "add_time"),
    updateTime: readString(deal, "update_time"),
  };
}

function normalizeDealDetail(
  deal: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...normalizeDealSummary(deal),
    probability: deal.probability,
    expectedCloseDate: readString(deal, "expected_close_date"),
  };
}

function normalizePerson(
  person: Record<string, unknown>,
  includePii: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: readId(person, "id"),
    orgId: readId(person, "org_id"),
    ownerId: readId(person, "owner_id"),
    addTime: readString(person, "add_time"),
    updateTime: readString(person, "update_time"),
  };
  if (includePii) {
    return {
      ...base,
      name: truncate(readString(person, "name") ?? "", OUTPUT_MAX_NAME_LENGTH),
      emails: person.email,
      phones: person.phone,
    };
  }
  return base;
}

function normalizeOrganization(
  organization: Record<string, unknown>,
  includePii: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: readId(organization, "id"),
    name: truncate(
      readString(organization, "name") ?? "",
      OUTPUT_MAX_NAME_LENGTH,
    ),
    ownerId: readId(organization, "owner_id"),
    peopleCount: readId(organization, "people_count"),
    addTime: readString(organization, "add_time"),
    updateTime: readString(organization, "update_time"),
  };
  if (includePii) {
    return {
      ...base,
      address: organization.address,
    };
  }
  return base;
}
