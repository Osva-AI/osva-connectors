import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";
import {
  filterNormalizedProperties,
  type CrmObjectType,
} from "./property-allowlist.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function normalizePropertyValue(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeTruncatableProviderString(
      value,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

export function normalizeCrmObject(
  objectType: CrmObjectType,
  raw: unknown,
  includePii: boolean,
): Record<string, unknown> {
  const record = asRecord(raw);
  if (record === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot returned an unexpected CRM object payload.",
    );
  }
  const id =
    typeof record.id === "string"
      ? normalizeEssentialProviderString(
          record.id,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const propertiesRaw = asRecord(record.properties) ?? {};
  const filtered = filterNormalizedProperties(
    objectType,
    propertiesRaw,
    includePii,
  );
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filtered)) {
    const normalized = normalizePropertyValue(value);
    if (normalized !== undefined) {
      properties[key] = normalized;
    }
  }
  return {
    ...(id !== undefined ? { id } : {}),
    properties,
    ...(typeof record.archived === "boolean"
      ? { archived: record.archived }
      : {}),
  };
}

export function mapCrmObjectListResponse(
  objectType: CrmObjectType,
  rows: readonly unknown[],
  includePii: boolean,
  pagination: {
    readonly nextCursor?: string;
    readonly rowsTruncated?: boolean;
  },
): unknown {
  const normalized = rows.map((row) =>
    normalizeCrmObject(objectType, row, includePii),
  );
  const key =
    objectType === "contacts"
      ? ("contacts" as const)
      : objectType === "companies"
        ? ("companies" as const)
        : ("deals" as const);
  const envelope = {
    kind: objectType,
    ...(pagination.nextCursor !== undefined
      ? { nextCursor: pagination.nextCursor }
      : {}),
    ...(pagination.rowsTruncated === true
      ? { rowsTruncated: true as const }
      : {}),
  };
  const result = packListWithinOutputBudget(envelope, key, normalized);
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapCrmObjectGetResponse(
  objectType: CrmObjectType,
  raw: unknown,
  includePii: boolean,
): unknown {
  const result = {
    kind: objectType,
    object: normalizeCrmObject(objectType, raw, includePii),
  };
  assertStructuredOutputWithinBudget(result);
  return result;
}

function normalizePipelineStage(stage: unknown): Record<string, unknown> {
  const record = asRecord(stage);
  if (record === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot returned an unexpected pipeline stage.",
    );
  }
  const id =
    typeof record.id === "string"
      ? normalizeEssentialProviderString(
          record.id,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const label =
    typeof record.label === "string"
      ? normalizeTruncatableProviderString(
          record.label,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value
      : undefined;
  return {
    ...(id !== undefined ? { id } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(typeof record.displayOrder === "number"
      ? { displayOrder: record.displayOrder }
      : {}),
  };
}

export function mapPipelineListResponse(raw: unknown): unknown {
  const record = asRecord(raw);
  const results = Array.isArray(record?.results) ? record.results : [];
  const pipelines = results.map((item) => {
    const pipeline = asRecord(item);
    if (pipeline === undefined) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "HubSpot returned an unexpected pipeline payload.",
      );
    }
    const id =
      typeof pipeline.id === "string"
        ? normalizeEssentialProviderString(
            pipeline.id,
            OUTPUT_MAX_PROVIDER_STRING_LENGTH,
          )
        : undefined;
    const label =
      typeof pipeline.label === "string"
        ? normalizeTruncatableProviderString(
            pipeline.label,
            OUTPUT_MAX_PROVIDER_STRING_LENGTH,
          ).value
        : undefined;
    const stages = Array.isArray(pipeline.stages)
      ? pipeline.stages.map(normalizePipelineStage)
      : [];
    return {
      ...(id !== undefined ? { id } : {}),
      ...(label !== undefined ? { label } : {}),
      stages,
    };
  });
  const result = packListWithinOutputBudget(
    { kind: "pipeline" as const },
    "pipelines",
    pipelines,
  );
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function normalizeOwner(
  raw: unknown,
  includePii: boolean,
): Record<string, unknown> {
  const record = asRecord(raw);
  if (record === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot returned an unexpected owner payload.",
    );
  }
  const id =
    typeof record.id === "string"
      ? normalizeEssentialProviderString(
          record.id,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const owner: Record<string, unknown> = {
    ...(id !== undefined ? { id } : {}),
  };
  if (includePii) {
    if (typeof record.email === "string") {
      owner.email = normalizeTruncatableProviderString(
        record.email,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
    }
    if (typeof record.firstName === "string") {
      owner.firstName = normalizeTruncatableProviderString(
        record.firstName,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
    }
    if (typeof record.lastName === "string") {
      owner.lastName = normalizeTruncatableProviderString(
        record.lastName,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
    }
  }
  return owner;
}

export function mapOwnerListResponse(
  rows: readonly unknown[],
  includePii: boolean,
  pagination: {
    readonly nextCursor?: string;
    readonly rowsTruncated?: boolean;
  },
): unknown {
  const owners = rows.map((row) => normalizeOwner(row, includePii));
  const envelope = {
    kind: "owner" as const,
    ...(pagination.nextCursor !== undefined
      ? { nextCursor: pagination.nextCursor }
      : {}),
    ...(pagination.rowsTruncated === true
      ? { rowsTruncated: true as const }
      : {}),
  };
  const result = packListWithinOutputBudget(envelope, "owners", owners);
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function normalizeAssociation(raw: unknown): Record<string, unknown> {
  const record = asRecord(raw);
  if (record === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot returned an unexpected association payload.",
    );
  }
  const toObjectId =
    typeof record.toObjectId === "number" ||
    typeof record.toObjectId === "string"
      ? String(record.toObjectId)
      : undefined;
  const associationTypes = Array.isArray(record.associationTypes)
    ? record.associationTypes
        .map((entry) => {
          const typeRecord = asRecord(entry);
          if (typeRecord === undefined) {
            return undefined;
          }
          const categoryId =
            typeof typeRecord.category === "string"
              ? normalizeTruncatableProviderString(
                  typeRecord.category,
                  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
                ).value
              : undefined;
          const typeId =
            typeof typeRecord.typeId === "number" &&
            Number.isFinite(typeRecord.typeId)
              ? typeRecord.typeId
              : undefined;
          return {
            ...(categoryId !== undefined ? { category: categoryId } : {}),
            ...(typeId !== undefined ? { typeId } : {}),
          };
        })
        .filter((entry) => entry !== undefined)
    : [];
  return {
    ...(toObjectId !== undefined ? { toObjectId } : {}),
    associationTypes,
  };
}

export function mapAssociationListResponse(
  rows: readonly unknown[],
  pagination: {
    readonly nextCursor?: string;
    readonly rowsTruncated?: boolean;
  },
): unknown {
  const associations = rows.map(normalizeAssociation);
  const envelope = {
    kind: "association" as const,
    ...(pagination.nextCursor !== undefined
      ? { nextCursor: pagination.nextCursor }
      : {}),
    ...(pagination.rowsTruncated === true
      ? { rowsTruncated: true as const }
      : {}),
  };
  const result = packListWithinOutputBudget(
    envelope,
    "associations",
    associations,
  );
  assertStructuredOutputWithinBudget(result);
  return result;
}
