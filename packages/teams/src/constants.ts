export const CONNECTOR_KEY = "osva-connector-teams";
export const CONNECTOR_NAME = "OSVA Teams Connector";
export const CONNECTOR_VERSION = "0.1.0";

/** Read tools */
export const TEAMS_TEAM_LIST_TOOL = "teams.team.list";
export const TEAMS_CHANNEL_LIST_TOOL = "teams.channel.list";
export const TEAMS_CHANNEL_MESSAGE_LIST_TOOL = "teams.channel.message.list";
export const TEAMS_CHANNEL_REPLY_LIST_TOOL = "teams.channel.reply.list";
export const TEAMS_CHAT_LIST_TOOL = "teams.chat.list";
export const TEAMS_CHAT_MESSAGE_LIST_TOOL = "teams.chat.message.list";

/** Mutations (non-idempotent; not retried) */
export const TEAMS_CHANNEL_MESSAGE_SEND_TOOL = "teams.channel.message.send";
export const TEAMS_CHAT_MESSAGE_SEND_TOOL = "teams.chat.message.send";

export const GRAPH_API_HOST = "https://graph.microsoft.com/v1.0";

export const TEAMS_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_TEAMS_ACCESS_TOKEN";
export const TEAMS_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_TEAMS_TIMEOUT_MS";

export const TEAMS_ALLOWED_TEAM_IDS_ENV =
  "OSVA_CONNECTOR_TEAMS_ALLOWED_TEAM_IDS";
export const TEAMS_ALLOWED_CHANNEL_IDS_ENV =
  "OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_IDS";
export const TEAMS_ALLOWED_CHAT_IDS_ENV =
  "OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_IDS";

export const TEAMS_SEND_ENABLED_ENV = "OSVA_CONNECTOR_TEAMS_SEND_ENABLED";
export const TEAMS_HOST_SEND_APPROVED_ENV =
  "OSVA_CONNECTOR_TEAMS_HOST_SEND_APPROVED";

export const TEAMS_ALLOWED_CHANNEL_DESTINATIONS_ENV =
  "OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_DESTINATIONS";
export const TEAMS_ALLOWED_CHAT_DESTINATIONS_ENV =
  "OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_DESTINATIONS";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Maximum raw HTTP response bytes read before parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const LIST_DEFAULT_PAGE_SIZE = 25;
export const LIST_MAX_PAGE_SIZE = 50;

export const MAX_ODATA_LINK_LENGTH = 2048;
export const MAX_GRAPH_RESOURCE_ID_LENGTH = 256;

/** Max UTF-8 bytes for outbound message body content. */
export const MAX_MESSAGE_CONTENT_BYTES = 28_672;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
