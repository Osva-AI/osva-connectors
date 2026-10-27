import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { normalizeAccountIdInput } from "./account-id.js";

export function filterAllowedAccounts(
  accountId: string,
  allowedAccountIds: readonly string[] | undefined,
): boolean {
  if (allowedAccountIds === undefined || allowedAccountIds.length === 0) {
    return true;
  }
  return allowedAccountIds.includes(accountId);
}

export function assertAccountAllowed(
  accountId: string,
  allowedAccountIds: readonly string[] | undefined,
): void {
  if (allowedAccountIds === undefined || allowedAccountIds.length === 0) {
    return;
  }
  if (!allowedAccountIds.includes(accountId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Ad account ID is not in the configured allowlist.",
    );
  }
}

export function resolveAccountId(
  input: string | undefined,
  allowedAccountIds: readonly string[] | undefined,
): string {
  if (input === undefined || input.trim().length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "accountId is required.");
  }
  const accountId = normalizeAccountIdInput(input.trim());
  assertAccountAllowed(accountId, allowedAccountIds);
  return accountId;
}
