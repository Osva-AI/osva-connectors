import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { LIST_MAX_PROPERTIES } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

const UNEXPECTED =
  "Google Search Console returned an unexpected sites payload.";

export interface NormalizedProperty {
  readonly siteUrl: string;
  readonly permissionLevel: string;
}

export interface NormalizedPropertyList {
  readonly properties: NormalizedProperty[];
  readonly propertiesTruncated?: true;
}

export interface NormalizedPropertyGet {
  readonly siteUrl: string;
  readonly permissionLevel: string;
}

function mapPermissionLevel(value: unknown): string {
  return normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    UNEXPECTED,
  );
}

function mapSiteUrl(value: unknown): string {
  return normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    UNEXPECTED,
  );
}

export function mapPropertyListResponse(raw: unknown): NormalizedPropertyList {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const siteEntry = (raw as { siteEntry?: unknown }).siteEntry;
  if (!Array.isArray(siteEntry)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }

  const properties: NormalizedProperty[] = [];
  for (const entry of siteEntry.slice(0, LIST_MAX_PROPERTIES)) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const record = entry as { siteUrl?: unknown; permissionLevel?: unknown };
    properties.push({
      siteUrl: mapSiteUrl(record.siteUrl),
      permissionLevel: mapPermissionLevel(record.permissionLevel),
    });
  }

  const envelope: NormalizedPropertyList = { properties: [] };
  const packed = packListWithinOutputBudget(envelope, "properties", properties);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapPropertyGetResponse(raw: unknown): NormalizedPropertyGet {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const record = raw as { siteUrl?: unknown; permissionLevel?: unknown };
  const result: NormalizedPropertyGet = {
    siteUrl: mapSiteUrl(record.siteUrl),
    permissionLevel: mapPermissionLevel(record.permissionLevel),
  };
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function normalizeUntrustedSiteLabel(value: unknown): string {
  return normalizeTruncatableProviderString(
    typeof value === "string" ? value : "",
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
}
