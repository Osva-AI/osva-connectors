import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { validateStripeApiKeyFormat } from "./api-key.js";
import {
  DEFAULT_MAX_ROWS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  STRIPE_ALLOWED_CUSTOMERS_ENV,
  STRIPE_ALLOW_LIVE_MODE_ENV,
  STRIPE_API_KEY_ENV,
  STRIPE_MAX_ROWS_ENV,
  STRIPE_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseAllowedStripeCustomers } from "./customer-allowlist.js";
import {
  assertLiveModeKeyAllowed,
  readAllowLiveModeFlag,
} from "./live-mode-guard.js";
import { stripeConfigSchema, type StripeConfig } from "./schemas.js";

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be an integer.`,
    );
  }
  return value;
}

export function loadStripeConfig(
  env: NodeJS.ProcessEnv = process.env,
): StripeConfig {
  const rawKey = env[STRIPE_API_KEY_ENV];
  if (rawKey === undefined || rawKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Stripe API key is not configured.",
    );
  }

  const apiKey = rawKey.trim();
  validateStripeApiKeyFormat(apiKey);

  const allowLiveMode = readAllowLiveModeFlag(env[STRIPE_ALLOW_LIVE_MODE_ENV]);
  assertLiveModeKeyAllowed(apiKey, allowLiveMode);

  const requestTimeoutMs = readBoundedInt(
    env[STRIPE_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxRows = readBoundedInt(
    env[STRIPE_MAX_ROWS_ENV],
    DEFAULT_MAX_ROWS,
    "Max rows",
  );
  const allowedCustomerIds = parseAllowedStripeCustomers(
    env[STRIPE_ALLOWED_CUSTOMERS_ENV],
  );

  const parsed = stripeConfigSchema.safeParse({
    apiKey,
    requestTimeoutMs,
    maxRows,
    allowedCustomerIds,
    allowLiveMode,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Stripe connector configuration is invalid.",
    );
  }

  return parsed.data;
}
