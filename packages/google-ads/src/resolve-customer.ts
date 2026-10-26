import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { normalizeCustomerIdInput } from "./customer-id.js";

export function assertCustomerAllowed(
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

export function resolveCustomerId(
  input: string | undefined,
  allowedCustomerIds: readonly string[] | undefined,
): string {
  if (input === undefined || input.trim().length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "customerId is required.");
  }
  const customerId = normalizeCustomerIdInput(input.trim());
  assertCustomerAllowed(customerId, allowedCustomerIds);
  return customerId;
}
