import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { assertStructuredOutputWithinBudget } from "./output-budget.js";

export function mapTemplateAnalyticsResponse(
  raw: unknown,
  context: {
    wabaId: string;
    startDate: string;
    endDate: string;
    templateIds: readonly string[];
  },
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp returned an unexpected analytics payload.",
    );
  }

  const payload = {
    provenance: {
      source: "whatsapp.business_management_api",
      edge: "template_analytics",
      granularity: "DAILY" as const,
      productType: "CLOUD_API" as const,
      note: "Template analytics require prior insights confirmation on the WABA. Read/click metrics have a 7-day attribution window per Meta documentation.",
    },
    wabaId: context.wabaId,
    startDate: context.startDate,
    endDate: context.endDate,
    templateIds: [...context.templateIds],
    data: (raw as Record<string, unknown>).data ?? [],
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}
