import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { AMPLITUDE_API_HOST_EU, AMPLITUDE_API_HOST_US } from "./constants.js";

const PRODUCTION_HOSTS = new Set([
  new URL(AMPLITUDE_API_HOST_US).hostname,
  new URL(AMPLITUDE_API_HOST_EU).hostname,
]);

export function resolveAmplitudeApiHost(
  region: "us" | "eu",
): typeof AMPLITUDE_API_HOST_US | typeof AMPLITUDE_API_HOST_EU {
  return region === "eu" ? AMPLITUDE_API_HOST_EU : AMPLITUDE_API_HOST_US;
}

export function assertAllowedAmplitudeUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Amplitude request URL is invalid.",
    );
  }

  const normalizedHost = apiHost.replace(/\/$/, "");
  const onHost =
    url === normalizedHost ||
    url.startsWith(`${normalizedHost}/`) ||
    url.startsWith(`${normalizedHost.replace(/\/$/, "")}/`);
  if (!onHost) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Amplitude request URL is not allowed.",
    );
  }

  if (
    normalizedHost === AMPLITUDE_API_HOST_US ||
    normalizedHost === AMPLITUDE_API_HOST_EU
  ) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Amplitude request URL is not allowed.",
      );
    }
    if (!PRODUCTION_HOSTS.has(parsed.hostname)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Amplitude request URL is not allowed.",
      );
    }
    return;
  }

  if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Amplitude request URL is not allowed.",
    );
  }
}
