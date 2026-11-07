import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const MAX_FILTER_FIELDS = 32;
const MAX_FILTER_DEPTH = 3;
const MAX_FIELD_KEY_LENGTH = 256;
const MAX_STRING_VALUE_LENGTH = 2_048;
const MAX_FILTER_JSON_BYTES = 16_384;

const OPERATORS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFilterSize(filter: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(filter), "utf8");
  if (bytes > MAX_FILTER_JSON_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone metadata filter exceeds the connector size limit.",
    );
  }
}

function validateScalar(value: unknown): void {
  if (typeof value === "string") {
    if ([...value].length > MAX_STRING_VALUE_LENGTH) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Pinecone filter string value is too long.",
      );
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Pinecone filter number must be finite.",
      );
    }
    return;
  }
  if (typeof value === "boolean") {
    return;
  }
  throw new ConnectorSdkError(
    "INVALID_INPUT",
    "Pinecone filter scalar type is not supported.",
  );
}

function validateOperatorObject(value: Record<string, unknown>, depth: number) {
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone filter operator object must have exactly one operator.",
    );
  }
  const op = keys[0]!;
  if (!OPERATORS.has(op)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone filter operator is not supported.",
    );
  }
  const operand = value[op];
  if (op === "$in" || op === "$nin") {
    if (
      !Array.isArray(operand) ||
      operand.length === 0 ||
      operand.length > 50
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Pinecone $in/$nin filter must be a bounded non-empty array.",
      );
    }
    for (const item of operand) {
      validateScalar(item);
    }
    return;
  }
  validateScalar(operand);
  if (depth >= MAX_FILTER_DEPTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone metadata filter nesting is too deep.",
    );
  }
}

function validateFieldValue(value: unknown, depth: number): void {
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.some((k) => k.startsWith("$"))) {
      validateOperatorObject(value, depth);
      return;
    }
    if (depth >= MAX_FILTER_DEPTH) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Pinecone metadata filter nesting is too deep.",
      );
    }
    for (const nestedKey of keys) {
      if (nestedKey.length > MAX_FIELD_KEY_LENGTH) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Pinecone filter field key is too long.",
        );
      }
      validateFieldValue(value[nestedKey], depth + 1);
    }
    return;
  }
  validateScalar(value);
}

/**
 * Validates a restricted Pinecone metadata filter subset ($eq, $ne, ranges, $in).
 */
export function parsePineconeMetadataFilter(filter: unknown): unknown {
  if (!isPlainObject(filter)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone metadata filter must be an object.",
    );
  }
  assertFilterSize(filter);
  const keys = Object.keys(filter);
  if (keys.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone metadata filter must not be empty.",
    );
  }
  if (keys.length > MAX_FILTER_FIELDS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone metadata filter has too many fields.",
    );
  }
  for (const key of keys) {
    if (key.length === 0 || key.length > MAX_FIELD_KEY_LENGTH) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Pinecone filter field key is invalid.",
      );
    }
    validateFieldValue(filter[key], 1);
  }
  return filter;
}
