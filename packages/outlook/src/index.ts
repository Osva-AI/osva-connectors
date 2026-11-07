export { createOutlookConnector } from "./connector.js";
export type { CreateOutlookConnectorOptions } from "./connector.js";
export { loadOutlookConfig } from "./config.js";
export { createGraphRestClient } from "./graph-rest-client.js";
export type {
  CreateGraphRestClientOptions,
  GraphHttpError,
} from "./graph-rest-client.js";
export { mapGraphError } from "./map-graph-error.js";
export {
  assertAllowedGraphUrl,
  extractODataNextLink,
  validateNextLinkInput,
} from "./graph-pagination.js";
export {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  GRAPH_API_HOST,
  OUTLOOK_ACCESS_TOKEN_ENV,
  OUTLOOK_ALLOWED_CALENDAR_IDS_ENV,
  OUTLOOK_ALLOWED_MAIL_FOLDER_IDS_ENV,
  OUTLOOK_ALLOWED_RECIPIENTS_ENV,
  OUTLOOK_CALENDAR_LIST_TOOL,
  OUTLOOK_EVENT_CREATE_TOOL,
  OUTLOOK_EVENT_GET_TOOL,
  OUTLOOK_EVENT_LIST_TOOL,
  OUTLOOK_HOST_SEND_APPROVED_ENV,
  OUTLOOK_HOST_WRITES_APPROVED_ENV,
  OUTLOOK_MAIL_FOLDER_LIST_TOOL,
  OUTLOOK_MESSAGE_GET_TOOL,
  OUTLOOK_MESSAGE_LIST_TOOL,
  OUTLOOK_MESSAGE_SEARCH_TOOL,
  OUTLOOK_MESSAGE_SEND_TOOL,
  OUTLOOK_SEND_ENABLED_ENV,
  OUTLOOK_TIMEOUT_MS_ENV,
  OUTLOOK_WRITE_ENABLED_ENV,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./constants.js";
export type { OutlookClient } from "./outlook-client.js";
export type { OutlookConfig } from "./schemas.js";
