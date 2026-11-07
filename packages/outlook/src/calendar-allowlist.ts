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
      "Calendar allowlist is explicitly empty; no calendars are permitted.",
    );
  }
  const normalized = calendarId.trim();
  if (!allowlist.allowedIds.has(normalized)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} is not on the host-configured calendar allowlist.`,
    );
  }
}

export function assertCalendarMutationsAllowlistReady(
  allowlist: CalendarAllowlist | undefined,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Outlook calendar writes require a non-empty OSVA_CONNECTOR_OUTLOOK_ALLOWED_CALENDAR_IDS when the allowlist env var is set.",
    );
  }
}

export function filterByCalendarAllowlist<T>(
  allowlist: CalendarAllowlist | undefined,
  items: readonly T[],
  calendarIdOf: (item: T) => string | undefined,
): T[] {
  if (allowlist === undefined) {
    return [...items];
  }
  if (allowlist.allowedIds.size === 0) {
    return [];
  }
  return items.filter((item) => {
    const id = calendarIdOf(item);
    if (id === undefined) {
      return false;
    }
    return allowlist.allowedIds.has(id.trim());
  });
}
