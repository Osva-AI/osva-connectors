import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { z } from "zod";

export const CRM_OBJECT_TYPES = ["contacts", "companies", "deals"] as const;

export const crmObjectTypeSchema = z.enum(CRM_OBJECT_TYPES);

export type CrmObjectType = z.infer<typeof crmObjectTypeSchema>;

const BASE_PROPERTIES: Record<CrmObjectType, readonly string[]> = {
  contacts: [
    "hs_object_id",
    "createdate",
    "lastmodifieddate",
    "lifecyclestage",
    "hubspot_owner_id",
    "hs_lead_status",
  ],
  companies: [
    "hs_object_id",
    "createdate",
    "lastmodifieddate",
    "name",
    "domain",
    "industry",
    "type",
    "hubspot_owner_id",
  ],
  deals: [
    "hs_object_id",
    "createdate",
    "lastmodifieddate",
    "dealname",
    "dealstage",
    "pipeline",
    "amount",
    "closedate",
    "hubspot_owner_id",
  ],
};

const PII_PROPERTIES: Record<CrmObjectType, readonly string[]> = {
  contacts: [
    "email",
    "firstname",
    "lastname",
    "phone",
    "mobilephone",
    "company",
    "address",
    "city",
    "state",
    "zip",
    "country",
  ],
  companies: [
    "phone",
    "address",
    "address2",
    "city",
    "state",
    "zip",
    "country",
  ],
  deals: [],
};

const PROPERTY_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function parseAllowedObjectTypes(
  raw: string | undefined,
): CrmObjectType[] {
  const fallback = CRM_OBJECT_TYPES.join(",");
  const source = (raw ?? fallback).trim();
  if (source.length === 0) {
    return [...CRM_OBJECT_TYPES];
  }
  const parts = source
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Allowed object types must include at least one CRM object.",
    );
  }
  const unique = new Set<CrmObjectType>();
  for (const part of parts) {
    const parsed = crmObjectTypeSchema.safeParse(part);
    if (!parsed.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed object types contain an unsupported CRM object.",
      );
    }
    unique.add(parsed.data);
  }
  return [...unique];
}

export function assertObjectTypeAllowed(
  objectType: CrmObjectType,
  allowedObjectTypes: readonly CrmObjectType[],
): void {
  if (!allowedObjectTypes.includes(objectType)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "CRM object type is not allowed by connector configuration.",
    );
  }
}

export function resolveApiProperties(
  objectType: CrmObjectType,
  includePii: boolean,
): readonly string[] {
  const base = BASE_PROPERTIES[objectType];
  if (!includePii) {
    return base;
  }
  return [...base, ...PII_PROPERTIES[objectType]];
}

export function isAllowlistedPropertyName(
  objectType: CrmObjectType,
  propertyName: string,
  includePii: boolean,
): boolean {
  if (!PROPERTY_NAME_PATTERN.test(propertyName)) {
    return false;
  }
  const allowed = new Set(resolveApiProperties(objectType, includePii));
  return allowed.has(propertyName);
}

export function filterNormalizedProperties(
  objectType: CrmObjectType,
  properties: Record<string, unknown>,
  includePii: boolean,
): Record<string, unknown> {
  const allowed = new Set(resolveApiProperties(objectType, includePii));
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}
