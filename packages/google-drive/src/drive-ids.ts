import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_DRIVE_ID_LENGTH,
  MAX_FILE_ID_LENGTH,
  MAX_PAGE_TOKEN_LENGTH,
  MAX_DRIVE_QUERY_LENGTH,
} from "./constants.js";

const RESOURCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function invalidInput(message: string): never {
  throw new ConnectorSdkError("INVALID_INPUT", message);
}

export function parseFileId(raw: unknown): string {
  if (typeof raw !== "string") {
    invalidInput("fileId must be a string.");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_FILE_ID_LENGTH) {
    invalidInput("fileId is not valid.");
  }
  if (!RESOURCE_ID_PATTERN.test(trimmed)) {
    invalidInput("fileId is not valid.");
  }
  return trimmed;
}

export function parseDriveId(raw: unknown): string {
  if (typeof raw !== "string") {
    invalidInput("driveId must be a string.");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DRIVE_ID_LENGTH) {
    invalidInput("driveId is not valid.");
  }
  if (!RESOURCE_ID_PATTERN.test(trimmed)) {
    invalidInput("driveId is not valid.");
  }
  return trimmed;
}

export function parseOptionalDriveId(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  return parseDriveId(raw);
}

export function parsePageToken(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    invalidInput("pageToken must be a string.");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PAGE_TOKEN_LENGTH) {
    invalidInput("pageToken is not valid.");
  }
  if (/[\0\r\n]/.test(trimmed)) {
    invalidInput("pageToken is not valid.");
  }
  return trimmed;
}

export function parseRequiredPageToken(raw: unknown): string {
  const token = parsePageToken(raw);
  if (token === undefined) {
    invalidInput("pageToken is required.");
  }
  return token;
}

export function parseDriveSearchQuery(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    invalidInput("query must be a string.");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_DRIVE_QUERY_LENGTH) {
    invalidInput("query exceeds the maximum length.");
  }
  if (/[\0\r\n]/.test(trimmed)) {
    invalidInput("query contains invalid characters.");
  }
  return trimmed;
}

export function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function folderChildrenQuery(folderId: string): string {
  const escaped = escapeDriveQueryLiteral(folderId);
  return `'${escaped}' in parents and trashed = false`;
}
