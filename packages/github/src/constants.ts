export const CONNECTOR_KEY = "osva-connector-github";
export const CONNECTOR_NAME = "OSVA GitHub Connector";
export const CONNECTOR_VERSION = "0.2.0";

/** MCP tool name (dot-separated, stable for Connector Profile V1). */
export const GITHUB_REPOSITORY_GET_TOOL = "github.repository.get";
export const GITHUB_ISSUE_LIST_TOOL = "github.issue.list";
export const GITHUB_ISSUE_GET_TOOL = "github.issue.get";
export const GITHUB_ISSUE_CREATE_TOOL = "github.issue.create";
export const GITHUB_ISSUE_COMMENT_CREATE_TOOL = "github.issue.comment.create";

/** Issue creation input bounds (enforced before provider calls). */
export const ISSUE_CREATE_MAX_TITLE_LENGTH = 256;
export const ISSUE_CREATE_MAX_BODY_LENGTH = 32_000;

/** Issue comment body bound (enforced before provider calls). */
export const ISSUE_COMMENT_CREATE_MAX_BODY_LENGTH = 32_000;

/** Pagination bounds (enforced in Zod and provider calls). */
export const ISSUE_LIST_DEFAULT_PER_PAGE = 20;
export const ISSUE_LIST_MAX_PER_PAGE = 100;
export const ISSUE_LIST_MAX_PAGE = 100;

/** Output-size policy for normalized issue payloads. */
export const MAX_LABELS_PER_ISSUE = 30;
export const MAX_LABEL_NAME_LENGTH = 100;

export {
  OUTPUT_MAX_BRANCH_NAME,
  OUTPUT_MAX_COMMENT_BODY,
  OUTPUT_MAX_GITHUB_LOGIN,
  OUTPUT_MAX_ISSUE_TITLE,
  OUTPUT_MAX_ISO_TIMESTAMP,
  OUTPUT_MAX_REPO_DESCRIPTION,
  OUTPUT_MAX_REPO_FULL_NAME,
  OUTPUT_MAX_REPO_NAME,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  OUTPUT_MAX_URL,
} from "./output-budget.js";

/** Environment variable for a GitHub fine-grained personal access token. */
export const GITHUB_TOKEN_ENV = "OSVA_CONNECTOR_GITHUB_TOKEN";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
