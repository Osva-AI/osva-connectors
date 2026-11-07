import { ConnectorSdkError } from "@osva-ai/connector-sdk";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function assertDenseIndexForVectorOps(
  describePayload: Record<string, unknown>,
): void {
  const vectorType = describePayload.vector_type;
  if (vectorType === "sparse") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Sparse Pinecone indexes are not supported for vector query or upsert.",
    );
  }

  const spec = asRecord(describePayload.spec);
  if (spec !== undefined && spec.embed !== undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Integrated-embedding Pinecone indexes are not supported for vector query or upsert.",
    );
  }

  if (vectorType !== undefined && vectorType !== "dense") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Only dense Pinecone indexes are supported for vector query or upsert.",
    );
  }
}

export function extractIndexDimension(
  describePayload: Record<string, unknown>,
): number | undefined {
  const dimension = describePayload.dimension;
  if (
    typeof dimension === "number" &&
    Number.isInteger(dimension) &&
    dimension > 0
  ) {
    return dimension;
  }
  return undefined;
}

export function assertVectorLengthMatchesIndex(
  describePayload: Record<string, unknown>,
  vectorLength: number,
): void {
  const dimension = extractIndexDimension(describePayload);
  if (dimension === undefined) {
    return;
  }
  if (vectorLength !== dimension) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `Vector dimension ${vectorLength} does not match index dimension ${dimension}.`,
    );
  }
}

export function assertServerlessIndexForList(
  describePayload: Record<string, unknown>,
): void {
  const spec = asRecord(describePayload.spec);
  if (spec === undefined || spec.serverless === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Vector ID listing is supported only for serverless Pinecone indexes.",
    );
  }
}

export function extractIndexHost(
  describePayload: Record<string, unknown>,
): string {
  const host = describePayload.host;
  if (typeof host !== "string" || host.trim().length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pinecone index describe response is missing host.",
    );
  }
  return host.trim();
}
