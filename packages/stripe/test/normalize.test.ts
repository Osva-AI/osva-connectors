import { describe, expect, it } from "vitest";

import {
  mapChargeRow,
  mapInvoiceRow,
  mapPaymentIntentRow,
  mapSubscriptionRow,
} from "../src/normalize-resources.js";

describe("Stripe normalization", () => {
  it("preserves integer minor units and lowercase currency", () => {
    const pi = mapPaymentIntentRow({
      id: "pi_123",
      amount: 1000,
      amount_received: 1000,
      currency: "USD",
      status: "succeeded",
      created: 1,
      livemode: false,
    }) as Record<string, unknown>;
    expect(pi.amount).toBe(1000);
    expect(pi.currency).toBe("usd");
  });

  it("maps charge captured and refunded amounts separately", () => {
    const charge = mapChargeRow({
      id: "ch_123",
      amount: 5000,
      amount_captured: 5000,
      amount_refunded: 1000,
      currency: "usd",
      captured: true,
      refunded: false,
      status: "succeeded",
      created: 1,
      livemode: false,
    }) as Record<string, unknown>;
    expect(charge.amountCaptured).toBe(5000);
    expect(charge.amountRefunded).toBe(1000);
  });

  it("maps subscription billing interval and period fields", () => {
    const sub = mapSubscriptionRow({
      id: "sub_123",
      status: "active",
      customer: "cus_123",
      cancel_at_period_end: false,
      created: 1,
      livemode: false,
      items: {
        object: "list",
        data: [
          {
            current_period_start: 10,
            current_period_end: 20,
            price: {
              recurring: { interval: "month", interval_count: 1 },
            },
          },
        ],
      },
    }) as Record<string, unknown>;
    expect(sub.billingInterval).toBe("month");
    expect(sub.currentPeriodEnd).toBe(20);
  });

  it("preserves nullable invoice totals without fabricating zeros", () => {
    const invoice = mapInvoiceRow({
      id: "in_123",
      status: "open",
      currency: "usd",
      created: 1,
      livemode: false,
    }) as Record<string, unknown>;
    expect(invoice.subtotal).toBeNull();
    expect(invoice.amountDue).toBeNull();
  });
});
