import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_ISSUE_KEY_LENGTH,
  MAX_NEXT_PAGE_TOKEN_LENGTH,
  MAX_PROJECT_KEY_LENGTH,
} from "./constants.js";

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const ISSUE_KEY_PATTERN = /^([A-Z][A-Z0-9_]*)-(\d+)$/;

export function parseProjectKey(value: string, label: string): string {
  const trimmed = value.trim().toUpperCase();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_PROJECT_KEY_LENGTH ||
    !PROJECT_KEY_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed;
}

export function parseIssueKey(value: string, label: string): string {
  const trimmed = value.trim().toUpperCase();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_ISSUE_KEY_LENGTH ||
    !ISSUE_KEY_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed;
}

export function validateNextPageToken(
  token: string | undefined,
): string | undefined {
  if (token === undefined) {
    return undefined;
  }
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid Jira nextPageToken.");
  }
  if (trimmed.length > MAX_NEXT_PAGE_TOKEN_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid Jira nextPageToken.");
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("http://") ||
    lower.includes("https://") ||
    lower.includes("://")
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid Jira nextPageToken.");
  }
  return trimmed;
}
