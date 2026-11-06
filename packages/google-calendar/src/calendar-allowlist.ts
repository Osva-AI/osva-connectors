import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface CalendarAllowlist {
  readonly allowedIds: ReadonlySet<string>;
}

export function createCalendarAllowlist(
  ids: readonly string[] | undefined,
): CalendarAllowlist | undefined {
  if (ids === undefined) {
    return undefined;
  }
  return { allowedIds: new Set(ids) };
}

export function assertCalendarAllowed(
  allowlist: CalendarAllowlist | undefined,
  calendarId: string,
  label: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Calendar allowlist is explicitly empty; no calendar IDs are permitted.",
    );
  }
  if (!allowlist.allowedIds.has(calendarId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} is not on the host-configured calendar allowlist.`,
    );
  }
}
