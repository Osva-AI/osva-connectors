import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export const NPM_DOWNLOADS_PERIOD_LAST_MONTH = "last-month" as const;

export type NpmDownloadsPeriod = typeof NPM_DOWNLOADS_PERIOD_LAST_MONTH;

export interface NpmPackageMetadataInput {
  readonly packageName: string;
}

export interface NpmDownloadsInput {
  readonly packageName: string;
  readonly period: NpmDownloadsPeriod;
}

export interface NormalizedNpmPackageMetadata {
  readonly name: string;
  readonly latestVersion: string;
  readonly license?: string;
  readonly repositoryUrl?: string;
  readonly modifiedAt?: string;
  readonly deprecated?: string;
  readonly maintainersCount?: number;
}

export interface NormalizedNpmDownloads {
  readonly packageName: string;
  readonly period: NpmDownloadsPeriod;
  readonly downloads: number;
  readonly start: string;
  readonly end: string;
}

const NPM_UNSCOPED_NAME = /^[a-z0-9][a-z0-9._-]*$/i;
const NPM_SCOPED_NAME = /^@[a-z0-9][a-z0-9._-]+\/[a-z0-9][a-z0-9._-]*$/i;

function invalidInput(message: string): never {
  throw new ConnectorSdkError("INVALID_INPUT", message);
}

export function assertValidNpmPackageNameFormat(packageName: string): void {
  if (packageName.startsWith("@")) {
    if (!NPM_SCOPED_NAME.test(packageName)) {
      invalidInput("packageName is not a valid npm package name.");
    }
    return;
  }
  if (packageName.includes("/")) {
    invalidInput("packageName is not a valid npm package name.");
  }
  if (!NPM_UNSCOPED_NAME.test(packageName)) {
    invalidInput("packageName is not a valid npm package name.");
  }
}

export function normalizePackageNameInput(raw: unknown): string {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    invalidInput("Input must be a JSON object.");
  }

  const packageNameRaw = (raw as { packageName?: unknown }).packageName;
  if (typeof packageNameRaw !== "string") {
    invalidInput("packageName is required.");
  }

  const packageName = packageNameRaw.trim();
  if (packageName.length === 0) {
    invalidInput("packageName must be a non-empty string.");
  }

  if (/[\u0000-\u001F\u007F]/.test(packageName)) {
    invalidInput("packageName contains invalid control characters.");
  }

  assertValidNpmPackageNameFormat(packageName);
  return packageName;
}

export function parsePackageMetadataInput(
  input: unknown,
): NpmPackageMetadataInput {
  return { packageName: normalizePackageNameInput(input) };
}

export function parseDownloadsInput(input: unknown): NpmDownloadsInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    invalidInput("Input must be a JSON object.");
  }

  const record = input as { packageName?: unknown; period?: unknown };
  const packageName = normalizePackageNameInput(input);

  if (typeof record.period !== "string") {
    invalidInput("period is required.");
  }

  if (record.period !== NPM_DOWNLOADS_PERIOD_LAST_MONTH) {
    invalidInput(
      `Unsupported downloads period '${record.period}'. Only 'last-month' is supported.`,
    );
  }

  return {
    packageName,
    period: NPM_DOWNLOADS_PERIOD_LAST_MONTH,
  };
}
