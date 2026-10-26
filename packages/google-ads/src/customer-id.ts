import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_CUSTOMER_ID_DIGITS } from "./constants.js";

const CUSTOMER_ID_PATTERN = /^\d{10}$/;

export function normalizeCustomerIdInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!CUSTOMER_ID_PATTERN.test(digits)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Google Ads customer ID must be a 10-digit number.",
    );
  }
  if (digits.length > MAX_CUSTOMER_ID_DIGITS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Google Ads customer ID must be a 10-digit number.",
    );
  }
  return digits;
}

export function parseCustomerId(raw: string): string {
  return normalizeCustomerIdInput(raw.trim());
}

export function customerResourceName(customerId: string): string {
  return `customers/${customerId}`;
}
