import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_PROPERTY_ID_DIGITS } from "./constants.js";

const NUMERIC_PROPERTY_ID = /^\d{1,12}$/;

export function normalizePropertyIdInput(
  value: string | number | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (raw.length === 0) {
    return undefined;
  }
  if (raw.startsWith("properties/")) {
    return parsePropertyId(raw.slice("properties/".length));
  }
  return parsePropertyId(raw);
}

export function parsePropertyId(raw: string): string {
  const trimmed = raw.trim();
  if (!NUMERIC_PROPERTY_ID.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "GA4 property ID must be a numeric identifier.",
    );
  }
  if (trimmed.length > MAX_PROPERTY_ID_DIGITS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "GA4 property ID exceeds supported length.",
    );
  }
  return trimmed;
}

export function adminPropertyResourceName(propertyId: string): string {
  return `properties/${propertyId}`;
}

export function dataPropertyResourceName(propertyId: string): string {
  return `properties/${propertyId}`;
}
