import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const PINECONE_IO_SUFFIX = ".pinecone.io";

export interface DataHostValidationOptions {
  readonly allowLoopbackForTests?: boolean;
}

export function normalizePineconeDataHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pinecone index host is missing.",
    );
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    const parsed = new URL(trimmed);
    return parsed.origin;
  }
  return `https://${trimmed.replace(/\/$/, "")}`;
}

export function assertPineconeDataHost(
  host: string,
  options: DataHostValidationOptions = {},
): string {
  if (options.allowLoopbackForTests === true && !host.includes("://")) {
    const trimmed = host.trim().replace(/\/$/, "");
    const loopbackOrigin = `http://${trimmed}`;
    try {
      const parsed = new URL(loopbackOrigin);
      if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
        return loopbackOrigin;
      }
    } catch {
      // fall through
    }
  }

  const origin = normalizePineconeDataHost(host);
  const parsed = new URL(origin);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "127.0.0.1" || hostname === "localhost") {
    if (options.allowLoopbackForTests !== true) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Pinecone data-plane host is not allowed.",
      );
    }
    if (parsed.protocol === "https:") {
      return `http://${parsed.host}`;
    }
    return origin;
  }

  if (parsed.protocol !== "https:") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pinecone data-plane host must use HTTPS.",
    );
  }

  if (hostname !== "pinecone.io" && !hostname.endsWith(PINECONE_IO_SUFFIX)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pinecone data-plane host must be a pinecone.io hostname.",
    );
  }

  return origin;
}
