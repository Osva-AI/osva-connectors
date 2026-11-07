import { describe, expect, it } from "vitest";

import { createLinearGraphqlClient } from "../src/linear-graphql-client.js";
import { mapLinearError } from "../src/map-linear-error.js";
import { startMockLinearGraphqlServer } from "./fixtures/mock-linear-graphql-server.js";
import { FAKE_LINEAR_API_KEY } from "./helpers/test-env.js";

describe("Linear GraphQL regressions", () => {
  it("rejects HTTP 200 responses that include GraphQL errors", async () => {
    const server = await startMockLinearGraphqlServer({
      mode: "graphql_errors_with_data",
    });
    const client = createLinearGraphqlClient({
      authorizationHeader: FAKE_LINEAR_API_KEY,
      requestTimeoutMs: 5_000,
      apiHost: server.graphqlUrl,
    });
    try {
      try {
        await client.getViewer({});
        expect.fail("Expected GraphQL errors to fail the request");
      } catch (error) {
        expect(error).toMatchObject({ kind: "graphql" });
        expect(mapLinearError(error).code).not.toBe("INTERNAL_ERROR");
      }
    } finally {
      await server.close();
    }
  });

  it("rejects mutations when success is false", async () => {
    const server = await startMockLinearGraphqlServer({
      mode: "mutation_success_false",
    });
    const client = createLinearGraphqlClient({
      authorizationHeader: FAKE_LINEAR_API_KEY,
      requestTimeoutMs: 5_000,
      apiHost: server.graphqlUrl,
    });
    try {
      await expect(
        client.createIssue({
          teamId: server.fixtureTeamId,
          title: "Test",
        }),
      ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    } finally {
      await server.close();
    }
  });
});
