import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { assertLiveModeResourceAllowed } from "./live-mode-guard.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

function requireObject(raw: unknown, label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `${label} payload is unexpected.`,
    );
  }
  return raw as Record<string, unknown>;
}

function optionalIntegerMinorUnits(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Stripe amount field is unexpected.",
  );
}

function requiredIntegerMinorUnits(value: unknown, field: string): number {
  const parsed = optionalIntegerMinorUnits(value);
  if (parsed === undefined || parsed === null) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `Stripe ${field} is missing.`,
    );
  }
  return parsed;
}

function optionalCurrency(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe currency field is unexpected.",
    );
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(normalized)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe currency field is unexpected.",
    );
  }
  return normalized;
}

function optionalUnixTimestamp(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Stripe timestamp field is unexpected.",
  );
}

function optionalIdReference(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return normalizeEssentialProviderString(
      value,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") {
      return normalizeEssentialProviderString(
        id,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      );
    }
  }
  return undefined;
}

function optionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Stripe boolean field is unexpected.",
  );
}

function optionalStatusString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe status field is unexpected.",
    );
  }
  return normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
}

function mapBalanceAmounts(
  entries: unknown,
): Array<{ amount: number; currency: string }> {
  if (!Array.isArray(entries)) {
    return [];
  }
  const result: Array<{ amount: number; currency: string }> = [];
  for (const entry of entries) {
    const obj = requireObject(entry, "Balance amount");
    const amount = requiredIntegerMinorUnits(obj.amount, "amount");
    const currency = optionalCurrency(obj.currency);
    if (currency === undefined || currency === null) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Stripe balance currency is missing.",
      );
    }
    result.push({ amount, currency });
  }
  return result;
}

export interface NormalizeContext {
  readonly allowLiveMode: boolean;
}

export function mapAccountGetResponse(
  raw: unknown,
  context: NormalizeContext,
): unknown {
  const obj = requireObject(raw, "Account");
  assertLiveModeResourceAllowed(obj.livemode, context.allowLiveMode);
  const id =
    typeof obj.id === "string"
      ? normalizeEssentialProviderString(
          obj.id,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const country =
    typeof obj.country === "string"
      ? normalizeEssentialProviderString(
          obj.country,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : null;
  const defaultCurrency = optionalCurrency(obj.default_currency) ?? null;
  const payload = {
    id: id ?? null,
    country,
    defaultCurrency,
    chargesEnabled: optionalBoolean(obj.charges_enabled) ?? null,
    payoutsEnabled: optionalBoolean(obj.payouts_enabled) ?? null,
    detailsSubmitted: optionalBoolean(obj.details_submitted) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

export function mapBalanceGetResponse(
  raw: unknown,
  context: NormalizeContext,
): unknown {
  const obj = requireObject(raw, "Balance");
  assertLiveModeResourceAllowed(obj.livemode, context.allowLiveMode);
  const payload = {
    available: mapBalanceAmounts(obj.available),
    pending: mapBalanceAmounts(obj.pending),
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

export function mapBalanceTransactionRow(raw: unknown): unknown {
  const obj = requireObject(raw, "Balance transaction");
  return {
    id: normalizeEssentialProviderString(
      obj.id,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ),
    amount: requiredIntegerMinorUnits(obj.amount, "amount"),
    fee: requiredIntegerMinorUnits(obj.fee, "fee"),
    net: requiredIntegerMinorUnits(obj.net, "net"),
    currency: optionalCurrency(obj.currency) ?? null,
    type: optionalStatusString(obj.type) ?? null,
    sourceId: optionalIdReference(obj.source) ?? null,
    status: optionalStatusString(obj.status) ?? null,
    created: optionalUnixTimestamp(obj.created) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
}

export function mapPaymentIntentRow(raw: unknown): unknown {
  const obj = requireObject(raw, "PaymentIntent");
  return {
    id: normalizeEssentialProviderString(
      obj.id,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ),
    status: optionalStatusString(obj.status) ?? null,
    amount: requiredIntegerMinorUnits(obj.amount, "amount"),
    amountReceived: optionalIntegerMinorUnits(obj.amount_received) ?? null,
    currency: optionalCurrency(obj.currency) ?? null,
    created: optionalUnixTimestamp(obj.created) ?? null,
    customerId: optionalIdReference(obj.customer) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
}

export function mapPaymentIntentGetResponse(
  raw: unknown,
  context: NormalizeContext,
): unknown {
  const obj = requireObject(raw, "PaymentIntent");
  assertLiveModeResourceAllowed(obj.livemode, context.allowLiveMode);
  const payload = mapPaymentIntentRow(obj);
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

export function mapChargeRow(raw: unknown): unknown {
  const obj = requireObject(raw, "Charge");
  return {
    id: normalizeEssentialProviderString(
      obj.id,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ),
    paymentIntentId: optionalIdReference(obj.payment_intent) ?? null,
    amount: requiredIntegerMinorUnits(obj.amount, "amount"),
    amountCaptured: optionalIntegerMinorUnits(obj.amount_captured) ?? null,
    amountRefunded: optionalIntegerMinorUnits(obj.amount_refunded) ?? null,
    currency: optionalCurrency(obj.currency) ?? null,
    captured: optionalBoolean(obj.captured) ?? null,
    refunded: optionalBoolean(obj.refunded) ?? null,
    balanceTransactionId: optionalIdReference(obj.balance_transaction) ?? null,
    status: optionalStatusString(obj.status) ?? null,
    created: optionalUnixTimestamp(obj.created) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
}

export function mapRefundRow(raw: unknown): unknown {
  const obj = requireObject(raw, "Refund");
  const reasonRaw = obj.reason;
  let reason: string | null = null;
  if (reasonRaw !== undefined && reasonRaw !== null) {
    const normalized = normalizeTruncatableProviderString(
      reasonRaw,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
    reason = normalized.value;
  }
  return {
    id: normalizeEssentialProviderString(
      obj.id,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ),
    amount: requiredIntegerMinorUnits(obj.amount, "amount"),
    currency: optionalCurrency(obj.currency) ?? null,
    status: optionalStatusString(obj.status) ?? null,
    reason,
    chargeId: optionalIdReference(obj.charge) ?? null,
    paymentIntentId: optionalIdReference(obj.payment_intent) ?? null,
    created: optionalUnixTimestamp(obj.created) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
}

function subscriptionItemRows(items: unknown): unknown[] {
  if (Array.isArray(items)) {
    return items;
  }
  if (items !== null && typeof items === "object" && "data" in items) {
    const data = (items as { data?: unknown }).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

function subscriptionBillingInterval(items: unknown): {
  interval: string | null;
  intervalCount: number | null;
} {
  const rows = subscriptionItemRows(items);
  if (rows.length === 0) {
    return { interval: null, intervalCount: null };
  }
  const first = rows[0];
  const itemObj = requireObject(first, "Subscription item");
  const price = itemObj.price;
  if (price === null || typeof price !== "object") {
    return { interval: null, intervalCount: null };
  }
  const priceObj = price as Record<string, unknown>;
  const recurring = priceObj.recurring;
  if (recurring === null || typeof recurring !== "object") {
    return { interval: null, intervalCount: null };
  }
  const rec = recurring as Record<string, unknown>;
  const interval =
    typeof rec.interval === "string"
      ? normalizeEssentialProviderString(
          rec.interval,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : null;
  const intervalCount =
    typeof rec.interval_count === "number" &&
    Number.isInteger(rec.interval_count)
      ? rec.interval_count
      : null;
  return { interval, intervalCount };
}

function subscriptionPeriodFields(obj: Record<string, unknown>): {
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
} {
  let start = optionalUnixTimestamp(obj.current_period_start);
  let end = optionalUnixTimestamp(obj.current_period_end);
  if (start === undefined) {
    const rows = subscriptionItemRows(obj.items);
    const first = rows[0];
    if (first !== null && typeof first === "object") {
      const item = first as Record<string, unknown>;
      start = optionalUnixTimestamp(item.current_period_start) ?? start;
      end = optionalUnixTimestamp(item.current_period_end) ?? end;
    }
  }
  return {
    currentPeriodStart: start ?? null,
    currentPeriodEnd: end ?? null,
  };
}

export function mapSubscriptionRow(raw: unknown): unknown {
  const obj = requireObject(raw, "Subscription");
  const billing = subscriptionBillingInterval(obj.items);
  const period = subscriptionPeriodFields(obj);
  return {
    id: normalizeEssentialProviderString(
      obj.id,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ),
    status: optionalStatusString(obj.status) ?? null,
    customerId: optionalIdReference(obj.customer) ?? null,
    billingInterval: billing.interval,
    billingIntervalCount: billing.intervalCount,
    currentPeriodStart: period.currentPeriodStart,
    currentPeriodEnd: period.currentPeriodEnd,
    cancelAtPeriodEnd: optionalBoolean(obj.cancel_at_period_end) ?? null,
    canceledAt: optionalUnixTimestamp(obj.canceled_at) ?? null,
    endedAt: optionalUnixTimestamp(obj.ended_at) ?? null,
    created: optionalUnixTimestamp(obj.created) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
}

export function mapInvoiceRow(raw: unknown): unknown {
  const obj = requireObject(raw, "Invoice");
  return {
    id: normalizeEssentialProviderString(
      obj.id,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ),
    customerId: optionalIdReference(obj.customer) ?? null,
    subscriptionId: optionalIdReference(obj.subscription) ?? null,
    status: optionalStatusString(obj.status) ?? null,
    subtotal: optionalIntegerMinorUnits(obj.subtotal) ?? null,
    total: optionalIntegerMinorUnits(obj.total) ?? null,
    amountPaid: optionalIntegerMinorUnits(obj.amount_paid) ?? null,
    amountDue: optionalIntegerMinorUnits(obj.amount_due) ?? null,
    currency: optionalCurrency(obj.currency) ?? null,
    created: optionalUnixTimestamp(obj.created) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
}

export function mapCustomerGetResponse(
  raw: unknown,
  context: NormalizeContext,
): unknown {
  const obj = requireObject(raw, "Customer");
  assertLiveModeResourceAllowed(obj.livemode, context.allowLiveMode);
  const payload = {
    id: normalizeEssentialProviderString(
      obj.id,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ),
    created: optionalUnixTimestamp(obj.created) ?? null,
    delinquent: optionalBoolean(obj.delinquent) ?? null,
    currency: optionalCurrency(obj.currency) ?? null,
    balance: optionalIntegerMinorUnits(obj.balance) ?? null,
    livemode: optionalBoolean(obj.livemode) ?? null,
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

type ListEnvelope = {
  nextCursor?: string;
  rowsTruncated?: boolean;
};

function packMappedList<T extends object>(
  itemsKey: keyof T & string,
  envelope: ListEnvelope,
  items: readonly unknown[],
  mapper: (raw: unknown) => unknown,
): unknown {
  const mapped = items.map((row) => mapper(row));
  const base = {
    [itemsKey]: mapped,
    ...(envelope.nextCursor !== undefined
      ? { nextCursor: envelope.nextCursor }
      : {}),
    ...(envelope.rowsTruncated ? { rowsTruncated: true as const } : {}),
  };
  const packed = packListWithinOutputBudget(base, itemsKey, mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapBalanceTransactionListResponse(
  items: readonly unknown[],
  envelope: ListEnvelope,
): unknown {
  return packMappedList(
    "balanceTransactions",
    envelope,
    items,
    mapBalanceTransactionRow,
  );
}

export function mapPaymentIntentListResponse(
  items: readonly unknown[],
  envelope: ListEnvelope,
): unknown {
  return packMappedList("paymentIntents", envelope, items, mapPaymentIntentRow);
}

export function mapChargeListResponse(
  items: readonly unknown[],
  envelope: ListEnvelope,
): unknown {
  return packMappedList("charges", envelope, items, mapChargeRow);
}

export function mapRefundListResponse(
  items: readonly unknown[],
  envelope: ListEnvelope,
): unknown {
  return packMappedList("refunds", envelope, items, mapRefundRow);
}

export function mapSubscriptionListResponse(
  items: readonly unknown[],
  envelope: ListEnvelope,
): unknown {
  return packMappedList("subscriptions", envelope, items, mapSubscriptionRow);
}

export function mapInvoiceListResponse(
  items: readonly unknown[],
  envelope: ListEnvelope,
): unknown {
  return packMappedList("invoices", envelope, items, mapInvoiceRow);
}
