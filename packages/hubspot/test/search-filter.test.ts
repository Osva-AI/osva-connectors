import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { buildHubspotSearchBody } from "../src/search-filter.js";

describe("search filter builder", () => {
  it("builds validated search bodies", () => {
    const body = buildHubspotSearchBody(
      {
        objectType: "contacts",
        filterGroups: [
          {
            filters: [
              {
                propertyName: "lifecyclestage",
                operator: "EQ",
                value: "lead",
              },
            ],
          },
        ],
      },
      {
        allowedObjectTypes: ["contacts", "companies", "deals"],
        includePii: false,
        limit: 25,
        properties: ["lifecyclestage"],
      },
    );
    expect(body.limit).toBe(25);
    expect(body.properties).toEqual(["lifecyclestage"]);
  });

  it("rejects non-allowlisted filter properties", () => {
    expect(() =>
      buildHubspotSearchBody(
        {
          objectType: "contacts",
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "EQ",
                  value: "test@example.com",
                },
              ],
            },
          ],
        },
        {
          allowedObjectTypes: ["contacts"],
          includePii: false,
          limit: 10,
          properties: ["lifecyclestage"],
        },
      ),
    ).toThrow(ConnectorSdkError);
  });
});
