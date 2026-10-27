export const CONNECTOR_KEY = "osva-connector-whatsapp";
export const CONNECTOR_NAME = "OSVA WhatsApp Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL =
  "whatsapp.businessAccount.get";
export const WHATSAPP_PHONE_NUMBER_LIST_TOOL = "whatsapp.phoneNumber.list";
export const WHATSAPP_PHONE_NUMBER_GET_TOOL = "whatsapp.phoneNumber.get";
export const WHATSAPP_BUSINESS_PROFILE_GET_TOOL =
  "whatsapp.businessProfile.get";
export const WHATSAPP_TEMPLATE_LIST_TOOL = "whatsapp.template.list";
export const WHATSAPP_TEMPLATE_GET_TOOL = "whatsapp.template.get";
export const WHATSAPP_ANALYTICS_GET_TOOL = "whatsapp.analytics.get";
export const WHATSAPP_TEMPLATE_SEND_TOOL = "whatsapp.template.send";

export const WHATSAPP_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN";
export const WHATSAPP_WABA_ID_ENV = "OSVA_CONNECTOR_WHATSAPP_WABA_ID";
export const WHATSAPP_PHONE_NUMBER_ID_ENV =
  "OSVA_CONNECTOR_WHATSAPP_PHONE_NUMBER_ID";
export const WHATSAPP_APP_SECRET_ENV = "OSVA_CONNECTOR_WHATSAPP_APP_SECRET";
export const WHATSAPP_ALLOWED_PHONE_NUMBERS_ENV =
  "OSVA_CONNECTOR_WHATSAPP_ALLOWED_PHONE_NUMBERS";
export const WHATSAPP_ALLOWED_RECIPIENTS_ENV =
  "OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS";
export const WHATSAPP_SEND_ENABLED_ENV = "OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED";
export const WHATSAPP_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_WHATSAPP_TIMEOUT_MS";
export const WHATSAPP_MAX_ROWS_ENV = "OSVA_CONNECTOR_WHATSAPP_MAX_ROWS";

/** Graph permissions used by read tools and template send. */
export const WHATSAPP_MANAGEMENT_SCOPE = "whatsapp_business_management";
export const WHATSAPP_MESSAGING_SCOPE = "whatsapp_business_messaging";

export const META_GRAPH_API_HOST = "https://graph.facebook.com";
export const META_GRAPH_API_VERSION = "v26.0";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const DEFAULT_MAX_ROWS = 100;
export const MIN_MAX_ROWS = 1;
export const MAX_MAX_ROWS = 1_000;

export const LIST_DEFAULT_LIMIT = 25;
export const LIST_MAX_LIMIT = 100;
export const MAX_CURSOR_LENGTH = 512;

export const MAX_WABA_ID_LENGTH = 32;
export const MAX_PHONE_NUMBER_ID_LENGTH = 32;
export const MAX_TEMPLATE_ID_LENGTH = 32;
export const MAX_TEMPLATE_NAME_LENGTH = 512;
export const MAX_LANGUAGE_CODE_LENGTH = 16;

export const ANALYTICS_MAX_DATE_RANGE_DAYS = 90;
export const ANALYTICS_MAX_TEMPLATE_IDS = 10;

export const SEND_MAX_BODY_PARAMETERS = 10;
export const SEND_MAX_BODY_PARAMETER_LENGTH = 256;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only Graph: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const MAX_PAGINATION_PAGES = 20;
export const GRAPH_DEFAULT_PAGE_SIZE = 25;
export const GRAPH_MAX_PAGE_SIZE = 100;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
