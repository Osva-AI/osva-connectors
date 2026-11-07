import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_EVENT_TYPE_LENGTH } from "./constants.js";

/** Minimal Amplitude Dashboard REST event definition (event query parameter). */
export interface AmplitudeEventDefinition {
  readonly event_type: string;
  readonly [key: string]: unknown;
}

const MAX_EVENT_JSON_BYTES = 8_192;

function assertSafeEventDefinition(
  value: unknown,
  label: string,
): AmplitudeEventDefinition {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must be an object with event_type.`,
    );
  }
  const record = value as Record<string, unknown>;
  const eventType = record.event_type;
  if (typeof eventType !== "string") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must include a string event_type.`,
    );
  }
  const trimmed = eventType.trim();
  if (trimmed.length === 0 || [...trimmed].length > MAX_EVENT_TYPE_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} event_type is invalid.`,
    );
  }
  return { ...record, event_type: trimmed };
}

/**
 * JSON-stringifies an event definition for Amplitude `e` / `se` / `re` query params.
 * The caller should pass the result to URLSearchParams.append (which applies encoding).
 */
export function encodeEventJsonForQuery(
  value: unknown,
  label = "Event",
): string {
  const normalized = assertSafeEventDefinition(value, label);
  let serialized: string;
  try {
    serialized = JSON.stringify(normalized);
  } catch {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} could not be serialized to JSON.`,
    );
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_EVENT_JSON_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} JSON exceeds the maximum encoded size.`,
    );
  }
  return serialized;
}

export function encodeEventJsonArrayForQuery(
  values: readonly unknown[],
  label: string,
  maxEvents: number,
): readonly string[] {
  if (values.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} requires at least one event.`,
    );
  }
  if (values.length > maxEvents) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} supports at most ${maxEvents} events.`,
    );
  }
  return values.map((entry, index) =>
    encodeEventJsonForQuery(entry, `${label} ${index + 1}`),
  );
}
