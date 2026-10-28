import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { parseStripeCustomerId } from "./resource-id.js";

export function parseAllowedStripeCustomers(
  raw: string | undefined,
): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    let normalized: string;
    try {
      normalized = parseStripeCustomerId(part);
    } catch {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed customer list contains an invalid customer ID.",
      );
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

export function assertStripeCustomerAllowed(
  customerId: string,
  allowedCustomerIds: readonly string[] | undefined,
): void {
  if (allowedCustomerIds === undefined || allowedCustomerIds.length === 0) {
    return;
  }
  if (!allowedCustomerIds.includes(customerId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Customer ID is not in the configured allowlist.",
    );
  }
}

export function resolveOptionalStripeCustomerId(
  input: string | undefined,
  allowedCustomerIds: readonly string[] | undefined,
): string | undefined {
  if (input === undefined || input.trim().length === 0) {
    return undefined;
  }
  const customerId = parseStripeCustomerId(input.trim());
  assertStripeCustomerAllowed(customerId, allowedCustomerIds);
  return customerId;
}

export function resolveRequiredStripeCustomerId(
  input: string,
  allowedCustomerIds: readonly string[] | undefined,
): string {
  const customerId = parseStripeCustomerId(input.trim());
  assertStripeCustomerAllowed(customerId, allowedCustomerIds);
  return customerId;
}
