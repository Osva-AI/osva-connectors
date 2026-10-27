import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_FILTER_STRING_LENGTH } from "./constants.js";
import { parseKlaviyoResourceId } from "./resource-id.js";

export const REPORT_SEND_CHANNELS = [
  "email",
  "sms",
  "push-notification",
  "whatsapp",
] as const;

export type ReportSendChannel = (typeof REPORT_SEND_CHANNELS)[number];

const SEND_CHANNEL_SET = new Set<string>(REPORT_SEND_CHANNELS);

/** Safe printable filter literal (no quotes, control chars, or filter syntax). */
const FILTER_TEXT_PATTERN = /^[\w .@#%&/+-]{1,200}$/;

const MAX_TAG_LIST_ITEMS = 100;
const MAX_AND_CLAUSES = 8;

export interface CampaignReportFilterInput {
  readonly sendChannels?: readonly ReportSendChannel[];
  readonly campaignId?: string;
  readonly campaignMessageId?: string;
  readonly campaignMessageName?: string;
  readonly variation?: string;
  readonly variationName?: string;
  readonly textMessageFormat?: string;
  readonly tagIds?: readonly string[];
  readonly tagIdsMatchAll?: boolean;
  readonly tagNames?: readonly string[];
  readonly tagNamesMatchAll?: boolean;
}

export interface FlowReportFilterInput {
  readonly sendChannels?: readonly ReportSendChannel[];
  readonly flowId?: string;
  readonly flowName?: string;
  readonly flowMessageId?: string;
  readonly flowMessageName?: string;
  readonly variation?: string;
  readonly variationName?: string;
  readonly textMessageFormat?: string;
  readonly tagIds?: readonly string[];
  readonly tagIdsMatchAll?: boolean;
  readonly tagNames?: readonly string[];
  readonly tagNamesMatchAll?: boolean;
}

function quoteFilterString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function assertFilterText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!FILTER_TEXT_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} contains unsupported characters.`,
    );
  }
  return trimmed;
}

function assertResourceId(value: string, label: string): string {
  return parseKlaviyoResourceId(value, label);
}

function assertSendChannels(
  channels: readonly string[] | undefined,
): ReportSendChannel[] | undefined {
  if (channels === undefined || channels.length === 0) {
    return undefined;
  }
  if (channels.length > REPORT_SEND_CHANNELS.length) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Too many send channels in report filter.",
    );
  }
  const unique: ReportSendChannel[] = [];
  const seen = new Set<string>();
  for (const channel of channels) {
    const trimmed = channel.trim();
    if (!SEND_CHANNEL_SET.has(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Report filter send channel is not supported.",
      );
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    unique.push(trimmed as ReportSendChannel);
  }
  return unique;
}

function assertIdList(
  ids: readonly string[] | undefined,
  label: string,
): string[] | undefined {
  if (ids === undefined || ids.length === 0) {
    return undefined;
  }
  if (ids.length > MAX_TAG_LIST_ITEMS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} list exceeds the maximum size.`,
    );
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const parsed = assertResourceId(id, label);
    if (seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    normalized.push(parsed);
  }
  return normalized;
}

function assertNameList(
  names: readonly string[] | undefined,
  label: string,
): string[] | undefined {
  if (names === undefined || names.length === 0) {
    return undefined;
  }
  if (names.length > MAX_TAG_LIST_ITEMS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} list exceeds the maximum size.`,
    );
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const parsed = assertFilterText(name, label);
    if (seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    normalized.push(parsed);
  }
  return normalized;
}

function buildContainsChannelClause(
  channels: readonly ReportSendChannel[],
): string {
  const encoded = channels.map((c) => quoteFilterString(c)).join(",");
  return `contains-any(send_channel,[${encoded}])`;
}

function buildEqualsClause(field: string, value: string): string {
  return `equals(${field},${quoteFilterString(value)})`;
}

function buildListClause(
  field: string,
  operator: "contains-any" | "contains-all",
  values: readonly string[],
): string {
  const encoded = values.map((v) => quoteFilterString(v)).join(",");
  return `${operator}(${field},[${encoded}])`;
}

function finalizeFilter(clauses: string[]): string | undefined {
  if (clauses.length === 0) {
    return undefined;
  }
  if (clauses.length > MAX_AND_CLAUSES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Report filter has too many conditions.",
    );
  }
  const filter =
    clauses.length === 1 ? clauses[0]! : `and(${clauses.join(",")})`;
  if (filter.length > MAX_FILTER_STRING_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Report filter exceeds maximum length.",
    );
  }
  return filter;
}

export function buildCampaignValuesReportFilter(
  input: CampaignReportFilterInput | undefined,
): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  const clauses: string[] = [];

  const sendChannels = assertSendChannels(input.sendChannels);
  if (sendChannels !== undefined) {
    clauses.push(buildContainsChannelClause(sendChannels));
  }

  if (input.campaignId !== undefined) {
    clauses.push(
      buildEqualsClause(
        "campaign_id",
        assertResourceId(input.campaignId, "Campaign ID"),
      ),
    );
  }
  if (input.campaignMessageId !== undefined) {
    clauses.push(
      buildEqualsClause(
        "campaign_message_id",
        assertResourceId(input.campaignMessageId, "Campaign message ID"),
      ),
    );
  }
  if (input.campaignMessageName !== undefined) {
    clauses.push(
      buildEqualsClause(
        "campaign_message_name",
        assertFilterText(input.campaignMessageName, "Campaign message name"),
      ),
    );
  }
  if (input.variation !== undefined) {
    clauses.push(
      buildEqualsClause(
        "variation",
        assertFilterText(input.variation, "Variation"),
      ),
    );
  }
  if (input.variationName !== undefined) {
    clauses.push(
      buildEqualsClause(
        "variation_name",
        assertFilterText(input.variationName, "Variation name"),
      ),
    );
  }
  if (input.textMessageFormat !== undefined) {
    clauses.push(
      buildEqualsClause(
        "text_message_format",
        assertFilterText(input.textMessageFormat, "Text message format"),
      ),
    );
  }

  const tagIds = assertIdList(input.tagIds, "Tag ID");
  if (tagIds !== undefined) {
    clauses.push(
      buildListClause(
        "tag_id",
        input.tagIdsMatchAll === true ? "contains-all" : "contains-any",
        tagIds,
      ),
    );
  }

  const tagNames = assertNameList(input.tagNames, "Tag name");
  if (tagNames !== undefined) {
    clauses.push(
      buildListClause(
        "tag_name",
        input.tagNamesMatchAll === true ? "contains-all" : "contains-any",
        tagNames,
      ),
    );
  }

  if (input.tagIdsMatchAll === true && tagIds === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "tagIdsMatchAll requires tagIds.",
    );
  }
  if (input.tagNamesMatchAll === true && tagNames === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "tagNamesMatchAll requires tagNames.",
    );
  }

  return finalizeFilter(clauses);
}

export function buildFlowValuesReportFilter(
  input: FlowReportFilterInput | undefined,
): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  const clauses: string[] = [];

  const sendChannels = assertSendChannels(input.sendChannels);
  if (sendChannels !== undefined) {
    clauses.push(buildContainsChannelClause(sendChannels));
  }

  if (input.flowId !== undefined) {
    clauses.push(
      buildEqualsClause("flow_id", assertResourceId(input.flowId, "Flow ID")),
    );
  }
  if (input.flowName !== undefined) {
    clauses.push(
      buildEqualsClause(
        "flow_name",
        assertFilterText(input.flowName, "Flow name"),
      ),
    );
  }
  if (input.flowMessageId !== undefined) {
    clauses.push(
      buildEqualsClause(
        "flow_message_id",
        assertResourceId(input.flowMessageId, "Flow message ID"),
      ),
    );
  }
  if (input.flowMessageName !== undefined) {
    clauses.push(
      buildEqualsClause(
        "flow_message_name",
        assertFilterText(input.flowMessageName, "Flow message name"),
      ),
    );
  }
  if (input.variation !== undefined) {
    clauses.push(
      buildEqualsClause(
        "variation",
        assertFilterText(input.variation, "Variation"),
      ),
    );
  }
  if (input.variationName !== undefined) {
    clauses.push(
      buildEqualsClause(
        "variation_name",
        assertFilterText(input.variationName, "Variation name"),
      ),
    );
  }
  if (input.textMessageFormat !== undefined) {
    clauses.push(
      buildEqualsClause(
        "text_message_format",
        assertFilterText(input.textMessageFormat, "Text message format"),
      ),
    );
  }

  const tagIds = assertIdList(input.tagIds, "Tag ID");
  if (tagIds !== undefined) {
    clauses.push(
      buildListClause(
        "tag_id",
        input.tagIdsMatchAll === true ? "contains-all" : "contains-any",
        tagIds,
      ),
    );
  }

  const tagNames = assertNameList(input.tagNames, "Tag name");
  if (tagNames !== undefined) {
    clauses.push(
      buildListClause(
        "tag_name",
        input.tagNamesMatchAll === true ? "contains-all" : "contains-any",
        tagNames,
      ),
    );
  }

  if (input.tagIdsMatchAll === true && tagIds === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "tagIdsMatchAll requires tagIds.",
    );
  }
  if (input.tagNamesMatchAll === true && tagNames === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "tagNamesMatchAll requires tagNames.",
    );
  }

  return finalizeFilter(clauses);
}
