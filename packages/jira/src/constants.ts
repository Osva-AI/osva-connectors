export const CONNECTOR_KEY = "osva-connector-jira";
export const CONNECTOR_NAME = "OSVA Jira Connector";
export const CONNECTOR_VERSION = "0.1.1";

export const JIRA_PROJECT_LIST_TOOL = "jira.project.list";
export const JIRA_PROJECT_GET_TOOL = "jira.project.get";
export const JIRA_ISSUE_SEARCH_TOOL = "jira.issue.search";
export const JIRA_ISSUE_GET_TOOL = "jira.issue.get";
export const JIRA_ISSUE_TRANSITIONS_LIST_TOOL = "jira.issue.transitions.list";
export const JIRA_ISSUE_CREATE_TOOL = "jira.issue.create";
export const JIRA_ISSUE_UPDATE_TOOL = "jira.issue.update";
export const JIRA_ISSUE_COMMENT_CREATE_TOOL = "jira.issue.comment.create";
export const JIRA_ISSUE_TRANSITION_TOOL = "jira.issue.transition";

export const JIRA_SITE_URL_ENV = "OSVA_CONNECTOR_JIRA_SITE_URL";
export const JIRA_CLOUD_ID_ENV = "OSVA_CONNECTOR_JIRA_CLOUD_ID";
export const JIRA_EMAIL_ENV = "OSVA_CONNECTOR_JIRA_EMAIL";
export const JIRA_API_TOKEN_ENV = "OSVA_CONNECTOR_JIRA_API_TOKEN";
export const JIRA_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_JIRA_ACCESS_TOKEN";
export const JIRA_WRITE_ENABLED_ENV = "OSVA_CONNECTOR_JIRA_WRITE_ENABLED";
export const JIRA_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_JIRA_HOST_WRITES_APPROVED";
export const JIRA_ALLOWED_PROJECT_KEYS_ENV =
  "OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS";
export const JIRA_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_JIRA_TIMEOUT_MS";

export const ATLASSIAN_API_HOST = "https://api.atlassian.com";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;
export const MAX_NEXT_PAGE_TOKEN_LENGTH = 4_096;
export const MAX_ISSUE_KEY_LENGTH = 64;
export const MAX_PROJECT_KEY_LENGTH = 64;
export const MAX_JQL_LENGTH = 8_192;
export const MAX_SUMMARY_LENGTH = 512;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
