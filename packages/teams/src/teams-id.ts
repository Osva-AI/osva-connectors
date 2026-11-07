import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_GRAPH_RESOURCE_ID_LENGTH,
  MAX_ODATA_LINK_LENGTH,
} from "./constants.js";

const GRAPH_ID_PATTERN = /^[a-zA-Z0-9@._:-]+$/;
const GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function parseGraphResourceId(value: string, label: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_GRAPH_RESOURCE_ID_LENGTH ||
    !GRAPH_ID_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed;
}

export function parseTeamId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !GUID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid team ID.");
  }
  return trimmed;
}

export interface ChannelDestinationKey {
  readonly teamId: string;
  readonly channelId: string;
}

export function parseChannelDestinationPair(
  raw: string,
  label: string,
): ChannelDestinationKey {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("CONFIGURATION_ERROR", `Invalid ${label}.`);
  }
  const colon = trimmed.indexOf(":");
  if (colon <= 0) {
    throw new ConnectorSdkError("CONFIGURATION_ERROR", `Invalid ${label}.`);
  }
  const teamId = parseTeamId(trimmed.slice(0, colon));
  const channelId = parseGraphResourceId(
    trimmed.slice(colon + 1),
    "channel ID",
  );
  return { teamId, channelId };
}

export function channelDestinationKey(
  teamId: string,
  channelId: string,
): string {
  return `${teamId}:${channelId}`;
}

export function validateODataNextLink(
  nextLink: string | undefined,
): string | undefined {
  if (nextLink === undefined) {
    return undefined;
  }
  const trimmed = nextLink.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_ODATA_LINK_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination link is not valid.",
    );
  }
  if (/[\0\r\n]/.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination link is not valid.",
    );
  }
  return trimmed;
}
