export const CONNECTOR_KEY = "osva-connector-slack";
export const CONNECTOR_NAME = "OSVA Slack Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const SLACK_AUTH_TEST_TOOL = "slack.auth.test";
export const SLACK_CHANNEL_LIST_TOOL = "slack.channel.list";
export const SLACK_CHANNEL_INFO_TOOL = "slack.channel.info";
export const SLACK_MESSAGE_HISTORY_TOOL = "slack.message.history";
export const SLACK_MESSAGE_THREAD_TOOL = "slack.message.thread";
export const SLACK_MESSAGE_POST_TOOL = "slack.message.post";
export const SLACK_MESSAGE_REPLY_TOOL = "slack.message.reply";

export const SLACK_BOT_TOKEN_ENV = "OSVA_CONNECTOR_SLACK_BOT_TOKEN";
export const SLACK_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_SLACK_TIMEOUT_MS";
export const SLACK_ALLOWED_CHANNELS_ENV =
  "OSVA_CONNECTOR_SLACK_ALLOWED_CHANNELS";
export const SLACK_WRITE_ENABLED_ENV = "OSVA_CONNECTOR_SLACK_WRITE_ENABLED";

/** Production Slack Web API base (method names appended). Not configurable in production. */
export const SLACK_API_BASE_URL = "https://slack.com/api/";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_LIMIT = 50;
export const LIST_MAX_LIMIT = 200;
export const HISTORY_DEFAULT_LIMIT = 50;
export const HISTORY_MAX_LIMIT = 200;
export const MAX_CURSOR_LENGTH = 512;
export const MAX_MESSAGE_TEXT_INPUT_LENGTH = 4_000;
export const MAX_CHANNEL_TYPES = 2;

export const SLACK_CHANNEL_ID_PATTERN = /^[CG][A-Z0-9]{8,}$/;
export const SLACK_MESSAGE_TS_PATTERN = /^\d{1,16}\.\d{1,6}$/;

export const ALLOWED_CONVERSATION_TYPES = [
  "public_channel",
  "private_channel",
] as const;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only Slack API: at most one retry for eligible transient errors. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_MESSAGE_TEXT_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
