import { describe, expect, it } from "vitest";
import {
  buildAccountListSoql,
  buildContactListSoql,
  buildOpportunityListSoql,
  escapeSoqlLiteral,
} from "../src/soql-builder.js";
import { ConnectorSdkError } from "@osva-ai/connector-sdk";

describe("Salesforce SOQL builder", () => {
  it("escapes single quotes in literals", () => {
    expect(escapeSoqlLiteral("O'Brien")).toBe("O\\'Brien");
  });

  it("rejects SOQL injection in stage filter", () => {
    expect(() =>
      buildOpportunityListSoql(10, {
        stage: "Prospecting' OR Id != null OR StageName='",
      }),
    ).not.toThrow();
    const soql = buildOpportunityListSoql(10, {
      stage: "Prospecting' OR Id != null OR StageName='",
    });
    expect(soql).toMatch(/StageName = '.*\\'/);
    expect(soql).not.toContain("';");
  });

  it("builds account filter by id", () => {
    const soql = buildAccountListSoql(25, {
      accountId: "001000000000001AAA",
    });
    expect(soql).toContain("FROM Account");
    expect(soql).toContain("Id = '001000000000001AAA'");
    expect(soql).not.toContain("OFFSET");
  });

  it("builds contact filter by account", () => {
    const soql = buildContactListSoql(25, {
      accountId: "001000000000001AAA",
    });
    expect(soql).toContain("AccountId = '001000000000001AAA'");
  });

  it("builds opportunity filters", () => {
    const soql = buildOpportunityListSoql(20, {
      accountId: "001000000000001AAA",
      stage: "Prospecting",
      updatedSince: "2026-01-01",
      closeDateFrom: "2026-06-01",
      closeDateTo: "2026-12-31",
    });
    expect(soql).toContain("StageName = 'Prospecting'");
    expect(soql).toContain("LastModifiedDate >= 2026-01-01T00:00:00Z");
    expect(soql).toContain("CloseDate >= 2026-06-01");
    expect(soql).toContain("CloseDate <= 2026-12-31");
  });

  it("rejects malformed account id", () => {
    expect(() =>
      buildContactListSoql(10, { accountId: "'; DROP TABLE Contact;--" }),
    ).toThrow(ConnectorSdkError);
  });
});
