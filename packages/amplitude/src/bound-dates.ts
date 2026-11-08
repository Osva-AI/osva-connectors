import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_LOOKBACK_DAYS } from "./constants.js";

const YYYYMMDD_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

export function parseYyyymmddDate(value: string, label: string): Date {
  const trimmed = value.trim();
  const match = YYYYMMDD_PATTERN.exec(trimmed);
  if (match === null) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must be formatted YYYYMMDD.`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} is not a valid calendar date.`,
    );
  }
  return date;
}

export function assertBoundedDateRange(
  start: string,
  end: string,
  maxLookbackDays: number = MAX_LOOKBACK_DAYS,
): { readonly start: string; readonly end: string } {
  const startDate = parseYyyymmddDate(start, "Start date");
  const endDate = parseYyyymmddDate(end, "End date");
  if (endDate.getTime() < startDate.getTime()) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "End date must not be before start date.",
    );
  }
  const inclusiveDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (inclusiveDays > maxLookbackDays) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `Date range exceeds the maximum lookback of ${maxLookbackDays} days.`,
    );
  }
  return { start: start.trim(), end: end.trim() };
}
