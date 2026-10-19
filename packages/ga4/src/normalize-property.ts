import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";
import { parsePropertyId } from "./property-id.js";

const UNEXPECTED = "Google Analytics returned an unexpected property payload.";

function extractPropertyIdFromResource(name: unknown): string {
  const resource = normalizeEssentialProviderString(
    name,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    UNEXPECTED,
  );
  const prefix = "properties/";
  if (!resource.startsWith(prefix)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  return parsePropertyId(resource.slice(prefix.length));
}

export function mapPropertyListResponse(raw: unknown): {
  properties: Array<{
    propertyId: string;
    displayName: string;
    account?: string;
    propertyType?: string;
  }>;
  nextPageToken?: string;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const envelope = raw as {
    accountSummaries?: unknown;
    nextPageToken?: unknown;
  };

  const summaries = envelope.accountSummaries;
  if (!Array.isArray(summaries)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }

  const properties: Array<{
    propertyId: string;
    displayName: string;
    account?: string;
    propertyType?: string;
  }> = [];

  for (const summary of summaries) {
    if (summary === null || typeof summary !== "object") {
      continue;
    }
    const accountRaw = (summary as { account?: unknown }).account;
    let account: string | undefined;
    if (typeof accountRaw === "string" && accountRaw.length > 0) {
      account = normalizeTruncatableProviderString(
        accountRaw,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
    }
    const propertySummaries = (summary as { propertySummaries?: unknown })
      .propertySummaries;
    if (!Array.isArray(propertySummaries)) {
      continue;
    }
    for (const entry of propertySummaries) {
      if (entry === null || typeof entry !== "object") {
        continue;
      }
      const propertyResource = (entry as { property?: unknown }).property;
      const displayNameRaw = (entry as { displayName?: unknown }).displayName;
      const propertyTypeRaw = (entry as { propertyType?: unknown })
        .propertyType;
      const propertyId = extractPropertyIdFromResource(propertyResource);
      const displayName = normalizeTruncatableProviderString(
        displayNameRaw,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
      const mapped: {
        propertyId: string;
        displayName: string;
        account?: string;
        propertyType?: string;
      } = { propertyId, displayName };
      if (account !== undefined && account.length > 0) {
        mapped.account = account;
      }
      if (typeof propertyTypeRaw === "string" && propertyTypeRaw.length > 0) {
        mapped.propertyType = normalizeTruncatableProviderString(
          propertyTypeRaw,
          64,
        ).value;
      }
      properties.push(mapped);
    }
  }

  let nextPageToken: string | undefined;
  if (typeof envelope.nextPageToken === "string") {
    const token = envelope.nextPageToken.trim();
    if (token.length > 0) {
      nextPageToken = normalizeEssentialProviderString(token, 512, UNEXPECTED);
    }
  }

  const result = {
    properties,
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
  };
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapPropertyGetResponse(raw: unknown): {
  id: string;
  displayName: string;
  timeZone: string;
  currencyCode: string;
  propertyType?: string;
  industryCategory?: string;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const property = raw as Record<string, unknown>;
  const name = property.name;
  const id = extractPropertyIdFromResource(name);
  const displayName = normalizeTruncatableProviderString(
    property.displayName,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
  const timeZone = normalizeEssentialProviderString(
    property.timeZone,
    128,
    UNEXPECTED,
  );
  const currencyCode = normalizeEssentialProviderString(
    property.currencyCode,
    16,
    UNEXPECTED,
  );

  const result: {
    id: string;
    displayName: string;
    timeZone: string;
    currencyCode: string;
    propertyType?: string;
    industryCategory?: string;
  } = { id, displayName, timeZone, currencyCode };

  if (typeof property.propertyType === "string") {
    result.propertyType = normalizeTruncatableProviderString(
      property.propertyType,
      64,
    ).value;
  }
  if (typeof property.industryCategory === "string") {
    result.industryCategory = normalizeTruncatableProviderString(
      property.industryCategory,
      128,
    ).value;
  }

  assertStructuredOutputWithinBudget(result);
  return result;
}
