import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  STRIPE_ACCOUNT_GET_TOOL,
  STRIPE_BALANCE_GET_TOOL,
  STRIPE_BALANCE_TRANSACTION_LIST_TOOL,
  STRIPE_CHARGE_LIST_TOOL,
  STRIPE_CUSTOMER_GET_TOOL,
  STRIPE_INVOICE_LIST_TOOL,
  STRIPE_PAYMENT_INTENT_GET_TOOL,
  STRIPE_PAYMENT_INTENT_LIST_TOOL,
  STRIPE_REFUND_LIST_TOOL,
  STRIPE_SUBSCRIPTION_LIST_TOOL,
} from "./constants.js";
import { resolveOptionalStripeCustomerId } from "./customer-allowlist.js";
import { assertLiveModeResourceAllowed } from "./live-mode-guard.js";
import { mapStripeError } from "./map-stripe-error.js";
import {
  mapAccountGetResponse,
  mapBalanceGetResponse,
  mapBalanceTransactionListResponse,
  mapChargeListResponse,
  mapCustomerGetResponse,
  mapInvoiceListResponse,
  mapPaymentIntentGetResponse,
  mapPaymentIntentListResponse,
  mapRefundListResponse,
  mapSubscriptionListResponse,
  type NormalizeContext,
} from "./normalize-resources.js";
import type { StripeClient } from "./stripe-client.js";
import { fetchStripeListBounded } from "./stripe-list-fetch.js";
import {
  accountGetInputJsonSchema,
  accountGetInputSchema,
  balanceGetInputJsonSchema,
  balanceGetInputSchema,
  balanceTransactionListInputJsonSchema,
  balanceTransactionListInputSchema,
  chargeListInputJsonSchema,
  chargeListInputSchema,
  customerGetInputJsonSchema,
  customerGetInputSchema,
  invoiceListInputJsonSchema,
  invoiceListInputSchema,
  paymentIntentGetInputJsonSchema,
  paymentIntentGetInputSchema,
  paymentIntentListInputJsonSchema,
  paymentIntentListInputSchema,
  refundListInputJsonSchema,
  refundListInputSchema,
  subscriptionListInputJsonSchema,
  subscriptionListInputSchema,
} from "./tool-schemas.js";

export interface CreateStripeConnectorOptions {
  readonly client: StripeClient;
  readonly maxRows?: number;
  readonly allowedCustomerIds?: readonly string[];
  readonly allowLiveMode?: boolean;
  readonly apiKeyForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  apiKeyForRedaction?: string,
): ConnectorSdkError {
  return mapStripeError(error, { apiKey: apiKeyForRedaction });
}

function listEnvelope(fetched: {
  nextCursor?: string;
  rowsTruncated: boolean;
}): { nextCursor?: string; rowsTruncated?: boolean } {
  return {
    ...(fetched.nextCursor !== undefined
      ? { nextCursor: fetched.nextCursor }
      : {}),
    ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
  };
}

function assertRowsLiveModeAllowed(
  rows: unknown[],
  allowLiveMode: boolean,
): void {
  for (const row of rows) {
    if (row !== null && typeof row === "object" && "livemode" in row) {
      assertLiveModeResourceAllowed(
        (row as { livemode?: unknown }).livemode,
        allowLiveMode,
      );
    }
  }
}

export function createStripeConnector(
  options: CreateStripeConnectorOptions,
): DefinedConnector {
  const configuredMaxRows = options.maxRows ?? 100;
  const allowedCustomerIds = options.allowedCustomerIds;
  const allowLiveMode = options.allowLiveMode ?? false;
  const redactionToken = options.apiKeyForRedaction;
  const normalizeContext: NormalizeContext = { allowLiveMode };

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Stripe read-only connector for OSVA Connector Profile V1 (account, balance, payments, subscriptions, and invoices). Requires a restricted Stripe secret key with read permissions for the endpoints in use. Credentials are configured via environment variables only.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: STRIPE_ACCOUNT_GET_TOOL,
        description:
          "Returns Stripe account metadata from GET /v1/account (read-only).",
        inputSchema: accountGetInputJsonSchema,
        handler: async (_input, context) => {
          const parsed = accountGetInputSchema.safeParse(_input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getAccount({
              signal: context.signal,
            });
            return mapAccountGetResponse(raw, normalizeContext);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_BALANCE_GET_TOOL,
        description:
          "Returns Stripe balance (available and pending) from GET /v1/balance.",
        inputSchema: balanceGetInputJsonSchema,
        handler: async (_input, context) => {
          const parsed = balanceGetInputSchema.safeParse(_input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getBalance({
              signal: context.signal,
            });
            return mapBalanceGetResponse(raw, normalizeContext);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_BALANCE_TRANSACTION_LIST_TOOL,
        description:
          "Lists balance transactions with bounded pagination (GET /v1/balance_transactions).",
        inputSchema: balanceTransactionListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = balanceTransactionListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          try {
            const fetched = await fetchStripeListBounded({
              limit,
              ...(parsed.data.startingAfter !== undefined
                ? { startingAfter: parsed.data.startingAfter }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listBalanceTransactions({
                  limit: pageParams.limit,
                  ...(pageParams.startingAfter !== undefined
                    ? { startingAfter: pageParams.startingAfter }
                    : {}),
                  ...(parsed.data.createdGte !== undefined
                    ? { createdGte: parsed.data.createdGte }
                    : {}),
                  ...(parsed.data.createdLte !== undefined
                    ? { createdLte: parsed.data.createdLte }
                    : {}),
                  ...(parsed.data.type !== undefined
                    ? { type: parsed.data.type }
                    : {}),
                  signal: pageParams.signal,
                }),
            });
            assertRowsLiveModeAllowed(fetched.rows, allowLiveMode);
            return mapBalanceTransactionListResponse(
              fetched.rows,
              listEnvelope(fetched),
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_PAYMENT_INTENT_LIST_TOOL,
        description:
          "Lists PaymentIntents with bounded pagination (GET /v1/payment_intents).",
        inputSchema: paymentIntentListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = paymentIntentListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          const customer = resolveOptionalStripeCustomerId(
            parsed.data.customerId,
            allowedCustomerIds,
          );
          try {
            const fetched = await fetchStripeListBounded({
              limit,
              ...(parsed.data.startingAfter !== undefined
                ? { startingAfter: parsed.data.startingAfter }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listPaymentIntents({
                  limit: pageParams.limit,
                  ...(pageParams.startingAfter !== undefined
                    ? { startingAfter: pageParams.startingAfter }
                    : {}),
                  ...(parsed.data.createdGte !== undefined
                    ? { createdGte: parsed.data.createdGte }
                    : {}),
                  ...(parsed.data.createdLte !== undefined
                    ? { createdLte: parsed.data.createdLte }
                    : {}),
                  ...(customer !== undefined ? { customer } : {}),
                  signal: pageParams.signal,
                }),
            });
            assertRowsLiveModeAllowed(fetched.rows, allowLiveMode);
            return mapPaymentIntentListResponse(
              fetched.rows,
              listEnvelope(fetched),
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_PAYMENT_INTENT_GET_TOOL,
        description:
          "Retrieves a PaymentIntent by ID (GET /v1/payment_intents/:id).",
        inputSchema: paymentIntentGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = paymentIntentGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getPaymentIntent({
              id: parsed.data.paymentIntentId,
              signal: context.signal,
            });
            return mapPaymentIntentGetResponse(raw, normalizeContext);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_CHARGE_LIST_TOOL,
        description: "Lists charges with bounded pagination (GET /v1/charges).",
        inputSchema: chargeListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = chargeListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          const customer = resolveOptionalStripeCustomerId(
            parsed.data.customerId,
            allowedCustomerIds,
          );
          try {
            const fetched = await fetchStripeListBounded({
              limit,
              ...(parsed.data.startingAfter !== undefined
                ? { startingAfter: parsed.data.startingAfter }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listCharges({
                  limit: pageParams.limit,
                  ...(pageParams.startingAfter !== undefined
                    ? { startingAfter: pageParams.startingAfter }
                    : {}),
                  ...(parsed.data.createdGte !== undefined
                    ? { createdGte: parsed.data.createdGte }
                    : {}),
                  ...(parsed.data.createdLte !== undefined
                    ? { createdLte: parsed.data.createdLte }
                    : {}),
                  ...(customer !== undefined ? { customer } : {}),
                  ...(parsed.data.paymentIntentId !== undefined
                    ? { paymentIntent: parsed.data.paymentIntentId }
                    : {}),
                  signal: pageParams.signal,
                }),
            });
            assertRowsLiveModeAllowed(fetched.rows, allowLiveMode);
            return mapChargeListResponse(fetched.rows, listEnvelope(fetched));
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_REFUND_LIST_TOOL,
        description: "Lists refunds with bounded pagination (GET /v1/refunds).",
        inputSchema: refundListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = refundListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          try {
            const fetched = await fetchStripeListBounded({
              limit,
              ...(parsed.data.startingAfter !== undefined
                ? { startingAfter: parsed.data.startingAfter }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listRefunds({
                  limit: pageParams.limit,
                  ...(pageParams.startingAfter !== undefined
                    ? { startingAfter: pageParams.startingAfter }
                    : {}),
                  ...(parsed.data.createdGte !== undefined
                    ? { createdGte: parsed.data.createdGte }
                    : {}),
                  ...(parsed.data.createdLte !== undefined
                    ? { createdLte: parsed.data.createdLte }
                    : {}),
                  ...(parsed.data.chargeId !== undefined
                    ? { charge: parsed.data.chargeId }
                    : {}),
                  ...(parsed.data.paymentIntentId !== undefined
                    ? { paymentIntent: parsed.data.paymentIntentId }
                    : {}),
                  signal: pageParams.signal,
                }),
            });
            assertRowsLiveModeAllowed(fetched.rows, allowLiveMode);
            return mapRefundListResponse(fetched.rows, listEnvelope(fetched));
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_SUBSCRIPTION_LIST_TOOL,
        description:
          "Lists subscriptions with bounded pagination (GET /v1/subscriptions).",
        inputSchema: subscriptionListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = subscriptionListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          const customer = resolveOptionalStripeCustomerId(
            parsed.data.customerId,
            allowedCustomerIds,
          );
          try {
            const fetched = await fetchStripeListBounded({
              limit,
              ...(parsed.data.startingAfter !== undefined
                ? { startingAfter: parsed.data.startingAfter }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listSubscriptions({
                  limit: pageParams.limit,
                  ...(pageParams.startingAfter !== undefined
                    ? { startingAfter: pageParams.startingAfter }
                    : {}),
                  ...(customer !== undefined ? { customer } : {}),
                  ...(parsed.data.status !== undefined
                    ? { status: parsed.data.status }
                    : {}),
                  ...(parsed.data.createdGte !== undefined
                    ? { createdGte: parsed.data.createdGte }
                    : {}),
                  ...(parsed.data.createdLte !== undefined
                    ? { createdLte: parsed.data.createdLte }
                    : {}),
                  signal: pageParams.signal,
                }),
            });
            assertRowsLiveModeAllowed(fetched.rows, allowLiveMode);
            return mapSubscriptionListResponse(
              fetched.rows,
              listEnvelope(fetched),
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_INVOICE_LIST_TOOL,
        description:
          "Lists invoices with bounded pagination (GET /v1/invoices).",
        inputSchema: invoiceListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = invoiceListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          const customer = resolveOptionalStripeCustomerId(
            parsed.data.customerId,
            allowedCustomerIds,
          );
          try {
            const fetched = await fetchStripeListBounded({
              limit,
              ...(parsed.data.startingAfter !== undefined
                ? { startingAfter: parsed.data.startingAfter }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listInvoices({
                  limit: pageParams.limit,
                  ...(pageParams.startingAfter !== undefined
                    ? { startingAfter: pageParams.startingAfter }
                    : {}),
                  ...(customer !== undefined ? { customer } : {}),
                  ...(parsed.data.subscriptionId !== undefined
                    ? { subscription: parsed.data.subscriptionId }
                    : {}),
                  ...(parsed.data.status !== undefined
                    ? { status: parsed.data.status }
                    : {}),
                  ...(parsed.data.createdGte !== undefined
                    ? { createdGte: parsed.data.createdGte }
                    : {}),
                  ...(parsed.data.createdLte !== undefined
                    ? { createdLte: parsed.data.createdLte }
                    : {}),
                  signal: pageParams.signal,
                }),
            });
            assertRowsLiveModeAllowed(fetched.rows, allowLiveMode);
            return mapInvoiceListResponse(fetched.rows, listEnvelope(fetched));
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: STRIPE_CUSTOMER_GET_TOOL,
        description:
          "Retrieves minimal customer metadata by ID (GET /v1/customers/:id).",
        inputSchema: customerGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = customerGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          resolveOptionalStripeCustomerId(
            parsed.data.customerId,
            allowedCustomerIds,
          );
          try {
            const raw = await options.client.getCustomer({
              id: parsed.data.customerId,
              signal: context.signal,
            });
            return mapCustomerGetResponse(raw, normalizeContext);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
