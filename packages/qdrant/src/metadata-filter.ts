import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const MAX_FILTER_CONDITIONS = 32;
const MAX_FILTER_DEPTH = 4;
const MAX_FIELD_KEY_LENGTH = 256;
const MAX_MATCH_VALUE_LENGTH = 2_048;
const MAX_FILTER_JSON_BYTES = 16_384;

const CLAUSE_KEYS = new Set(["must", "should", "must_not"]);
const CONDITION_KEYS = new Set([
  "key",
  "match",
  "range",
  "is_empty",
  "is_null",
  "has_id",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFilterSize(filter: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(filter), "utf8");
  if (bytes > MAX_FILTER_JSON_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant metadata filter exceeds the connector size limit.",
    );
  }
}

function validateMatchValue(value: unknown): void {
  if (typeof value === "string" && [...value].length > MAX_MATCH_VALUE_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant filter match value is too long.",
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant filter match value must be finite.",
    );
  }
  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant filter match value type is not supported.",
    );
  }
}

function validateRange(range: unknown): void {
  if (!isPlainObject(range)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant filter range must be an object.",
    );
  }
  for (const key of Object.keys(range)) {
    if (key !== "lt" && key !== "lte" && key !== "gt" && key !== "gte") {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant filter range contains unsupported bounds.",
      );
    }
    const bound = range[key];
    if (typeof bound !== "number" || !Number.isFinite(bound)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant filter range bounds must be finite numbers.",
      );
    }
  }
}

function validateCondition(condition: unknown, depth: number): void {
  if (!isPlainObject(condition)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant filter condition must be an object.",
    );
  }
  for (const key of Object.keys(condition)) {
    if (CLAUSE_KEYS.has(key)) {
      validateClauseList(condition[key], depth + 1);
      continue;
    }
    if (!CONDITION_KEYS.has(key)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant filter condition contains unsupported fields.",
      );
    }
  }

  if (condition.key !== undefined) {
    if (
      typeof condition.key !== "string" ||
      condition.key.trim().length === 0 ||
      condition.key.length > MAX_FIELD_KEY_LENGTH
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant filter field key is invalid.",
      );
    }
  }

  const match = condition.match;
  if (match !== undefined) {
    if (!isPlainObject(match)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant filter match must be an object.",
      );
    }
    const matchKeys = Object.keys(match);
    if (matchKeys.length !== 1 || matchKeys[0] !== "value") {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant filter match supports only { value }.",
      );
    }
    validateMatchValue(match.value);
  }

  if (condition.range !== undefined) {
    validateRange(condition.range);
  }

  if (condition.is_empty !== undefined || condition.is_null !== undefined) {
    if (typeof condition.key !== "string") {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant is_empty/is_null filters require key.",
      );
    }
  }

  if (condition.has_id !== undefined) {
    const ids = condition.has_id;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant has_id filter must be a bounded ID list.",
      );
    }
    for (const id of ids) {
      if (typeof id !== "string" && typeof id !== "number") {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Qdrant has_id entries must be string or number.",
        );
      }
    }
  }
}

function validateClauseList(value: unknown, depth: number): void {
  if (depth > MAX_FILTER_DEPTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant metadata filter nesting is too deep.",
    );
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant filter clause list must be a non-empty array.",
    );
  }
  if (value.length > MAX_FILTER_CONDITIONS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant filter has too many conditions.",
    );
  }
  for (const item of value) {
    validateCondition(item, depth);
  }
}

/**
 * Validates a restricted Qdrant payload filter subset (must/should/must_not + match/range).
 */
export function parseQdrantMetadataFilter(filter: unknown): unknown {
  if (!isPlainObject(filter)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant metadata filter must be an object.",
    );
  }
  assertFilterSize(filter);

  const keys = Object.keys(filter);
  if (keys.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant metadata filter must not be empty.",
    );
  }

  let clauses = 0;
  for (const key of keys) {
    if (!CLAUSE_KEYS.has(key)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Qdrant metadata filter root supports only must, should, and must_not.",
      );
    }
    validateClauseList(filter[key], 1);
    clauses += 1;
  }
  if (clauses === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant metadata filter requires at least one clause.",
    );
  }
  return filter;
}
