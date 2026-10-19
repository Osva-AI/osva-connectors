import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { normalizePropertyIdInput } from "./property-id.js";

export function resolvePropertyId(
  input: string | number | undefined,
  defaultPropertyId: string | undefined,
): string {
  const resolved =
    normalizePropertyIdInput(input) ?? defaultPropertyId ?? undefined;
  if (resolved === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "propertyId is required when OSVA_CONNECTOR_GA4_PROPERTY_ID is not set.",
    );
  }
  return resolved;
}
