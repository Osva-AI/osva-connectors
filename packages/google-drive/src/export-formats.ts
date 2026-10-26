import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export const GOOGLE_APPS_DOCUMENT = "application/vnd.google-apps.document";
export const GOOGLE_APPS_SPREADSHEET =
  "application/vnd.google-apps.spreadsheet";
export const GOOGLE_APPS_PRESENTATION =
  "application/vnd.google-apps.presentation";

const TEXT_EXPORT_MIMES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
]);

const BINARY_EXPORT_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const EXPORT_BY_SOURCE: Readonly<Record<string, ReadonlySet<string>>> = {
  [GOOGLE_APPS_DOCUMENT]: new Set([
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  [GOOGLE_APPS_SPREADSHEET]: new Set([
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/pdf",
  ]),
  [GOOGLE_APPS_PRESENTATION]: new Set([
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
};

export function isWorkspaceNativeMime(mimeType: string): boolean {
  return (
    mimeType === GOOGLE_APPS_DOCUMENT ||
    mimeType === GOOGLE_APPS_SPREADSHEET ||
    mimeType === GOOGLE_APPS_PRESENTATION
  );
}

export function assertExportFormatAllowed(
  sourceMimeType: string,
  exportMimeType: string,
): void {
  const allowed = EXPORT_BY_SOURCE[sourceMimeType];
  if (allowed === undefined || !allowed.has(exportMimeType)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Export format is not supported for this Google Workspace file type.",
    );
  }
}

export function isTextualExportMime(mimeType: string): boolean {
  return TEXT_EXPORT_MIMES.has(mimeType);
}

export function isBinaryExportMime(mimeType: string): boolean {
  return BINARY_EXPORT_MIMES.has(mimeType);
}

export const STORED_TEXT_MIMES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
]);

export function assertStoredTextMime(mimeType: string): void {
  if (!STORED_TEXT_MIMES.has(mimeType)) {
    if (isWorkspaceNativeMime(mimeType)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Google Workspace files must be retrieved with drive.file.export, not drive.file.read.",
      );
    }
    throw new ConnectorSdkError(
      "UNSUPPORTED_FORMAT",
      "File MIME type is not supported for direct text retrieval.",
    );
  }
}
