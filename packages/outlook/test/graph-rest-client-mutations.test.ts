import { describe, expect, it, afterEach } from "vitest";

import {
  startMockGraphHttpServer,
  type MockGraphHttpServer,
} from "./fixtures/mock-graph-http-server.js";
import { createTestOutlookClient } from "./helpers/test-env.js";

describe("Outlook Graph REST mutations", () => {
  let server: MockGraphHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("does not retry sendMail on transient 5xx", async () => {
    server = await startMockGraphHttpServer({ mode: "server_error" });
    const client = createTestOutlookClient(server);
    await expect(
      client.sendMail({
        body: {
          message: {
            subject: "x",
            body: { contentType: "Text", content: "y" },
            toRecipients: [{ emailAddress: { address: "a@example.com" } }],
          },
          saveToSentItems: false,
        },
      }),
    ).rejects.toThrow();
    expect(server.getRequestCount()).toBe(1);
  });
});
