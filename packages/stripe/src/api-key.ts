import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/** Stripe secret and restricted key prefixes (test and live). */
const STRIPE_KEY_PATTERN = /^(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]{10,}$/;

export function validateStripeApiKeyFormat(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (trimmed.length < 16 || trimmed.length > 512) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Stripe API key format is not supported.",
    );
  }
  if (!STRIPE_KEY_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Stripe API key format is not supported.",
    );
  }
}

export function isLiveModeStripeKey(apiKey: string): boolean {
  const trimmed = apiKey.trim();
  return trimmed.includes("_live_");
}
