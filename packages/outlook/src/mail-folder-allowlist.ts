import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface MailFolderAllowlist {
  readonly allowedIds: ReadonlySet<string>;
}

export function createMailFolderAllowlist(
  ids: readonly string[] | undefined,
): MailFolderAllowlist | undefined {
  if (ids === undefined) {
    return undefined;
  }
  return { allowedIds: new Set(ids) };
}

export function assertMailFolderAllowed(
  allowlist: MailFolderAllowlist | undefined,
  folderId: string,
  label: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Mail folder allowlist is explicitly empty; no folders are permitted.",
    );
  }
  const normalized = folderId.trim();
  if (!allowlist.allowedIds.has(normalized)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} is not on the host-configured mail folder allowlist.`,
    );
  }
}

export function assertMailMutationsAllowlistReady(
  allowlist: MailFolderAllowlist | undefined,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Outlook send requires a non-empty OSVA_CONNECTOR_OUTLOOK_ALLOWED_MAIL_FOLDER_IDS when the allowlist env var is set.",
    );
  }
}

export function filterByMailFolderAllowlist<T>(
  allowlist: MailFolderAllowlist | undefined,
  items: readonly T[],
  folderIdOf: (item: T) => string | undefined,
): T[] {
  if (allowlist === undefined) {
    return [...items];
  }
  if (allowlist.allowedIds.size === 0) {
    return [];
  }
  return items.filter((item) => {
    const id = folderIdOf(item);
    if (id === undefined) {
      return false;
    }
    return allowlist.allowedIds.has(id.trim());
  });
}
