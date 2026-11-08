import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  MIXPANEL_QUERY_API_HOST_EU,
  MIXPANEL_QUERY_API_HOST_IN,
  MIXPANEL_QUERY_API_HOST_US,
} from "./constants.js";

export const mixpanelRegionSchema = z.enum(["us", "eu", "in"]);

export type MixpanelRegion = z.infer<typeof mixpanelRegionSchema>;

export function parseMixpanelRegion(raw: string | undefined): MixpanelRegion {
  if (raw === undefined || raw.trim().length === 0) {
    return "us";
  }
  const normalized = raw.trim().toLowerCase();
  const parsed = mixpanelRegionSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Mixpanel region must be us, eu, or in.",
    );
  }
  return parsed.data;
}

export function resolveMixpanelQueryApiHost(region: MixpanelRegion): string {
  switch (region) {
    case "eu":
      return MIXPANEL_QUERY_API_HOST_EU;
    case "in":
      return MIXPANEL_QUERY_API_HOST_IN;
    default:
      return MIXPANEL_QUERY_API_HOST_US;
  }
}

export const PRODUCTION_QUERY_HOSTS = new Set([
  MIXPANEL_QUERY_API_HOST_US,
  MIXPANEL_QUERY_API_HOST_EU,
  MIXPANEL_QUERY_API_HOST_IN,
]);
