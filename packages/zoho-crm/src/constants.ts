export const CONNECTOR_KEY = "osva-connector-zoho-crm";
export const CONNECTOR_NAME = "OSVA Zoho CRM Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const ZOHO_LEAD_LIST_TOOL = "zoho.lead.list";
export const ZOHO_LEAD_GET_TOOL = "zoho.lead.get";
export const ZOHO_ACCOUNT_LIST_TOOL = "zoho.account.list";
export const ZOHO_ACCOUNT_GET_TOOL = "zoho.account.get";
export const ZOHO_CONTACT_LIST_TOOL = "zoho.contact.list";
export const ZOHO_CONTACT_GET_TOOL = "zoho.contact.get";
export const ZOHO_DEAL_LIST_TOOL = "zoho.deal.list";
export const ZOHO_DEAL_GET_TOOL = "zoho.deal.get";
export const ZOHO_DEAL_STAGE_LIST_TOOL = "zoho.deal.stage.list";
export const ZOHO_DEAL_STAGE_SET_TOOL = "zoho.deal.stage.set";
export const ZOHO_DEAL_NOTE_ADD_TOOL = "zoho.deal.note.add";

export const ZOHO_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_ZOHO_CRM_ACCESS_TOKEN";
export const ZOHO_REGION_ENV = "OSVA_CONNECTOR_ZOHO_CRM_REGION";
export const ZOHO_API_BASE_URL_ENV = "OSVA_CONNECTOR_ZOHO_CRM_API_BASE_URL";
export const ZOHO_ALLOWED_DEAL_IDS_ENV =
  "OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_DEAL_IDS";
export const ZOHO_ALLOWED_TARGET_STAGES_ENV =
  "OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_TARGET_STAGES";
export const ZOHO_NOTES_ENABLED_ENV = "OSVA_CONNECTOR_ZOHO_CRM_NOTES_ENABLED";
export const ZOHO_STAGE_UPDATES_ENABLED_ENV =
  "OSVA_CONNECTOR_ZOHO_CRM_STAGE_UPDATES_ENABLED";
export const ZOHO_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_ZOHO_CRM_HOST_WRITES_APPROVED";
export const ZOHO_INCLUDE_PII_ENV = "OSVA_CONNECTOR_ZOHO_CRM_INCLUDE_PII";
export const ZOHO_ALLOW_TEST_API_HOST_ENV =
  "OSVA_CONNECTOR_ZOHO_CRM_ALLOW_TEST_API_HOST";
export const ZOHO_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_ZOHO_CRM_TIMEOUT_MS";

export const ZOHO_CRM_API_VERSION_PATH = "/crm/v8";
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;
export const LIST_DEFAULT_PER_PAGE = 25;
export const LIST_MAX_PER_PAGE = 200;
export const MAX_RECORD_ID_LENGTH = 32;
export const MAX_NOTE_BODY_LENGTH = 4_096;
export const MAX_NOTE_TITLE_LENGTH = 256;
export const MAX_STAGE_LENGTH = 120;
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const MAX_HTTP_REQUEST_BODY_BYTES = 65_536;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;
export const LIST_DEFAULT_PAGE = 1;
export const MAX_PAGE_NUMBER = 250;
export const OUTPUT_MAX_NAME_LENGTH = 512;
