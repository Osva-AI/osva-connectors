export { createGmailConnector } from "./connector.js";
export type { CreateGmailConnectorOptions } from "./connector.js";
export { loadGmailConfig } from "./config.js";
export {
  createGoogleAuthTokenProvider,
  createStaticBearerTokenProvider,
} from "./gmail-auth.js";
export type { GmailTokenProvider } from "./gmail-auth.js";
export { createGmailRestClient } from "./gmail-rest-client.js";
export type { CreateGmailRestClientOptions } from "./gmail-rest-client.js";
export { mapGmailError } from "./map-gmail-error.js";
export {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  GMAIL_ACCESS_TOKEN_ENV,
  GMAIL_ALLOWED_RECIPIENTS_ENV,
  GMAIL_API_HOST,
  GMAIL_COMPOSE_SCOPE,
  GMAIL_DELEGATED_USER_EMAIL_ENV,
  GMAIL_DRAFTS_ENABLED_ENV,
  GMAIL_DRAFT_CREATE_TOOL,
  GMAIL_DRAFT_LIST_TOOL,
  GMAIL_DRAFT_UPDATE_TOOL,
  GMAIL_HOST_SEND_APPROVED_ENV,
  GMAIL_LABEL_LIST_TOOL,
  GMAIL_MESSAGE_GET_TOOL,
  GMAIL_MESSAGE_LIST_TOOL,
  GMAIL_MESSAGE_SEND_TOOL,
  GMAIL_PROFILE_GET_TOOL,
  GMAIL_READONLY_SCOPE,
  GMAIL_SCOPES_ENV,
  GMAIL_SEND_ENABLED_ENV,
  GMAIL_SEND_SCOPE,
  GMAIL_THREAD_GET_TOOL,
  GMAIL_THREAD_LIST_TOOL,
  GMAIL_TIMEOUT_MS_ENV,
  GMAIL_USE_DOMAIN_DELEGATION_ENV,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./constants.js";
export type { GmailClient } from "./gmail-client.js";
export type { GmailConfig } from "./schemas.js";
