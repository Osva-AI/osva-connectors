import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  buildCampaignValuesReportFilter,
  buildFlowValuesReportFilter,
} from "../src/report-filter.js";

describe("report filter encoding", () => {
  it("builds campaign AND filter with escaped values", () => {
    const filter = buildCampaignValuesReportFilter({
      sendChannels: ["email", "sms"],
      campaignId: "camp01",
    });
    expect(filter).toBe(
      'and(contains-any(send_channel,["email","sms"]),equals(campaign_id,"camp01"))',
    );
  });

  it("builds flow equals filters", () => {
    const filter = buildFlowValuesReportFilter({
      flowId: "flow01",
      sendChannels: ["email"],
    });
    expect(filter).toContain('equals(flow_id,"flow01")');
    expect(filter).toContain("contains-any(send_channel");
  });

  it("rejects unsupported send channels", () => {
    expect(() =>
      buildCampaignValuesReportFilter({
        sendChannels: ["carrier_pigeon" as "email"],
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects campaign-only fields on flow filters indirectly via schema", () => {
    expect(() =>
      buildFlowValuesReportFilter({
        flowName: 'name with "quotes" and \\ backslash',
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects tagIdsMatchAll without tagIds", () => {
    expect(() =>
      buildCampaignValuesReportFilter({ tagIdsMatchAll: true }),
    ).toThrow(ConnectorSdkError);
  });
});
