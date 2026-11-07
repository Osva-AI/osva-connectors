import { createJiraRestClient } from "../../src/jira-rest-client.js";
import {
  FAKE_JIRA_ACCESS_TOKEN,
  FAKE_JIRA_API_TOKEN,
  FAKE_JIRA_EMAIL,
  type MockJiraHttpServer,
} from "../fixtures/mock-jira-http-server.js";

export function createTestJiraClient(
  server: MockJiraHttpServer,
  authMode: "basic" | "bearer" = "basic",
) {
  const authorizationHeader =
    authMode === "basic"
      ? `Basic ${Buffer.from(`${FAKE_JIRA_EMAIL}:${FAKE_JIRA_API_TOKEN}`, "utf8").toString("base64")}`
      : `Bearer ${FAKE_JIRA_ACCESS_TOKEN}`;

  return createJiraRestClient({
    apiBasePath: server.apiBasePath,
    authorizationHeader,
    requestTimeoutMs: 5_000,
    apiHost: server.apiBasePath,
  });
}

export { FAKE_JIRA_ACCESS_TOKEN, FAKE_JIRA_API_TOKEN, FAKE_JIRA_EMAIL };
