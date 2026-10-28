export const CONNECTOR_KEY = "osva-connector-stripe";
export const CONNECTOR_NAME = "OSVA Stripe Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const STRIPE_ACCOUNT_GET_TOOL = "stripe.account.get";
export const STRIPE_BALANCE_GET_TOOL = "stripe.balance.get";
export const STRIPE_BALANCE_TRANSACTION_LIST_TOOL =
  "stripe.balanceTransaction.list";
export const STRIPE_PAYMENT_INTENT_LIST_TOOL = "stripe.paymentIntent.list";
export const STRIPE_PAYMENT_INTENT_GET_TOOL = "stripe.paymentIntent.get";
export const STRIPE_CHARGE_LIST_TOOL = "stripe.charge.list";
export const STRIPE_REFUND_LIST_TOOL = "stripe.refund.list";
export const STRIPE_SUBSCRIPTION_LIST_TOOL = "stripe.subscription.list";
export const STRIPE_INVOICE_LIST_TOOL = "stripe.invoice.list";
export const STRIPE_CUSTOMER_GET_TOOL = "stripe.customer.get";

export const STRIPE_API_KEY_ENV = "OSVA_CONNECTOR_STRIPE_API_KEY";
export const STRIPE_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_STRIPE_TIMEOUT_MS";
export const STRIPE_MAX_ROWS_ENV = "OSVA_CONNECTOR_STRIPE_MAX_ROWS";
export const STRIPE_ALLOWED_CUSTOMERS_ENV =
  "OSVA_CONNECTOR_STRIPE_ALLOWED_CUSTOMERS";
export const STRIPE_ALLOW_LIVE_MODE_ENV =
  "OSVA_CONNECTOR_STRIPE_ALLOW_LIVE_MODE";

/** Pinned Stripe API version (Stripe-Version header). See packages/stripe/README.md. */
export const STRIPE_API_VERSION = "2025-09-30.clover";

export const STRIPE_API_HOST = "https://api.stripe.com";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const DEFAULT_MAX_ROWS = 100;
export const MIN_MAX_ROWS = 1;
export const MAX_MAX_ROWS = 1_000;

export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;
export const MAX_CURSOR_LENGTH = 512;
export const MAX_RESOURCE_ID_LENGTH = 255;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const MAX_PAGINATION_PAGES = 20;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
