import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const UNIX_TIMESTAMP_PATTERN = /^\d{1,12}$/;

export function parseUnixTimestampFilter(
  raw: number | undefined,
  label: string,
): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Number.isInteger(raw) || raw < 0) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  const asString = String(raw);
  if (!UNIX_TIMESTAMP_PATTERN.test(asString)) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  return asString;
}

const BALANCE_TRANSACTION_TYPES = new Set([
  "adjustment",
  "advance",
  "advance_funding",
  "anticipation_repayment",
  "application_fee",
  "application_fee_refund",
  "charge",
  "climate_order_purchase",
  "climate_order_refund",
  "connect_collection_transfer",
  "contribution",
  "issuing_authorization_hold",
  "issuing_authorization_release",
  "issuing_dispute",
  "issuing_transaction",
  "obligation_inbound",
  "obligation_outbound",
  "payment",
  "payment_failure_refund",
  "payment_network_reserve_hold",
  "payment_network_reserve_release",
  "payment_refund",
  "payment_reversal",
  "payment_unreconciled",
  "payout",
  "payout_cancel",
  "payout_failure",
  "refund",
  "refund_failure",
  "reserve_transaction",
  "stripe_fee",
  "stripe_fx_fee",
  "tax_fee",
  "topup",
  "topup_reversal",
  "transfer",
  "transfer_cancel",
  "transfer_failure",
  "transfer_refund",
]);

export function parseBalanceTransactionType(
  raw: string | undefined,
): string | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const normalized = raw.trim();
  if (!BALANCE_TRANSACTION_TYPES.has(normalized)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Balance transaction type filter is not supported.",
    );
  }
  return normalized;
}

const SUBSCRIPTION_STATUSES = new Set([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

export function parseSubscriptionStatusFilter(
  raw: string | undefined,
): string | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const normalized = raw.trim();
  if (!SUBSCRIPTION_STATUSES.has(normalized)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Subscription status filter is not supported.",
    );
  }
  return normalized;
}

const INVOICE_STATUSES = new Set([
  "draft",
  "open",
  "paid",
  "uncollectible",
  "void",
]);

export function parseInvoiceStatusFilter(
  raw: string | undefined,
): string | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const normalized = raw.trim();
  if (!INVOICE_STATUSES.has(normalized)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Invoice status filter is not supported.",
    );
  }
  return normalized;
}
