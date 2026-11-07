export const CONNECTOR_KEY = "osva-connector-linear";
export const CONNECTOR_NAME = "OSVA Linear Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const LINEAR_VIEWER_GET_TOOL = "linear.viewer.get";
export const LINEAR_TEAM_LIST_TOOL = "linear.team.list";
export const LINEAR_ISSUE_LIST_TOOL = "linear.issue.list";
export const LINEAR_ISSUE_GET_TOOL = "linear.issue.get";
export const LINEAR_ISSUE_SEARCH_TOOL = "linear.issue.search";
export const LINEAR_PROJECT_LIST_TOOL = "linear.project.list";
export const LINEAR_PROJECT_GET_TOOL = "linear.project.get";
export const LINEAR_ISSUE_CREATE_TOOL = "linear.issue.create";
export const LINEAR_ISSUE_UPDATE_TOOL = "linear.issue.update";
export const LINEAR_COMMENT_CREATE_TOOL = "linear.comment.create";

export const LINEAR_API_KEY_ENV = "OSVA_CONNECTOR_LINEAR_API_KEY";
export const LINEAR_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN";
export const LINEAR_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_LINEAR_TIMEOUT_MS";
export const LINEAR_WRITE_ENABLED_ENV = "OSVA_CONNECTOR_LINEAR_WRITE_ENABLED";
export const LINEAR_HOST_MUTATIONS_APPROVED_ENV =
  "OSVA_CONNECTOR_LINEAR_HOST_MUTATIONS_APPROVED";
export const LINEAR_ALLOWED_TEAM_IDS_ENV =
  "OSVA_CONNECTOR_LINEAR_ALLOWED_TEAM_IDS";

export const LINEAR_API_HOST = "https://api.linear.app";
export const LINEAR_GRAPHQL_PATH = "/graphql";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_FIRST = 50;
export const LIST_MAX_FIRST = 100;
export const MAX_CURSOR_LENGTH = 512;
export const MAX_LINEAR_ID_LENGTH = 64;
export const MAX_ISSUE_SEARCH_QUERY_LENGTH = 512;
export const MAX_COMMENT_BODY_LENGTH = 16_384;
export const MAX_ISSUE_TITLE_LENGTH = 512;
export const MAX_ISSUE_DESCRIPTION_LENGTH = 32_768;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
