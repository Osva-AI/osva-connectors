import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const DOWNLOAD_HOST_SUFFIXES = [
  ".sharepoint.com",
  ".sharepoint-df.com",
  ".onedrive.com",
  "download.microsoft.com",
  "public.dm.files.1drv.com",
] as const;

const MAX_REDIRECTS = 3;

function hostAllowedForGraphDownload(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower.endsWith(".blob.core.windows.net")) {
    return true;
  }
  return DOWNLOAD_HOST_SUFFIXES.some(
    (suffix) => lower === suffix.slice(1) || lower.endsWith(suffix),
  );
}

export function assertAllowedGraphContentDownloadUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive download redirect URL is invalid.",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive download redirect URL must use HTTPS.",
    );
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive download redirect URL must not include credentials.",
    );
  }
  if (!hostAllowedForGraphDownload(parsed.hostname)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive download redirect host is not allowed.",
    );
  }
  return parsed;
}

export function parseGraphContentRedirectLocation(
  location: string | null,
): string {
  if (location === null || location.trim().length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive content redirect is missing a Location header.",
    );
  }
  return assertAllowedGraphContentDownloadUrl(location.trim()).toString();
}

export const GRAPH_CONTENT_MAX_REDIRECTS = MAX_REDIRECTS;
