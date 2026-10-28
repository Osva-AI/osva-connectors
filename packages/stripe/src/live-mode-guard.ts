import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { isLiveModeStripeKey } from "./api-key.js";

export function readAllowLiveModeFlag(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Live mode flag must be true or false.",
  );
}

export function assertLiveModeKeyAllowed(
  apiKey: string,
  allowLiveMode: boolean,
): void {
  if (!allowLiveMode && isLiveModeStripeKey(apiKey)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Live Stripe API keys are disabled. Set OSVA_CONNECTOR_STRIPE_ALLOW_LIVE_MODE=true to enable.",
    );
  }
}

export function assertLiveModeResourceAllowed(
  livemode: unknown,
  allowLiveMode: boolean,
): void {
  if (!allowLiveMode && livemode === true) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Live-mode Stripe data is not permitted by connector configuration.",
    );
  }
}
