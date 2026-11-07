import { describe, expect, it } from "vitest";

import { createNotionRestClient } from "../src/notion-rest-client.js";
import {
  MOCK_BLOCK_ID,
  MOCK_PAGE_ID,
  startMockNotionHttpServer,
} from "./fixtures/mock-notion-http-server.js";
import { FAKE_NOTION_ACCESS_TOKEN } from "./helpers/test-env.js";
import { normalizeBlockList } from "../src/normalize-notion.js";
import { normalizePageRecord } from "../src/normalize-notion.js";

describe("Notion API 2026-03-11 regressions", () => {
  it("normalizes in_trash instead of deprecated archived", () => {
    const output = normalizePageRecord({
      object: "page",
      id: MOCK_PAGE_ID,
      in_trash: true,
    });
    expect(output.inTrash).toBe(true);
    expect(output).not.toHaveProperty("archived");
  });

  it("normalizes meeting_notes blocks", () => {
    const blocks = normalizeBlockList(
      [
        {
          object: "block",
          id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          type: "meeting_notes",
          meeting_notes: {
            title: "Standup notes",
            rich_text: [
              { type: "text", text: { content: "Discussed release" } },
            ],
          },
          has_children: false,
        },
      ],
      { maxBlockDepth: 2 },
    );
    expect(blocks[0]?.blockType).toBe("meeting_notes");
    expect(blocks[0]?.content).toMatchObject({
      title: "Standup notes",
      untrustedContent: true,
    });
  });

  it("sends in_trash on page update for 2026-03-11", async () => {
    const server = await startMockNotionHttpServer();
    let lastBody: unknown;
    const nativeFetch = globalThis.fetch;
    const fetchImpl: typeof fetch = async (input, init) => {
      if (
        typeof input === "string" &&
        input.includes("/v1/pages/") &&
        init?.method === "PATCH" &&
        typeof init.body === "string"
      ) {
        lastBody = JSON.parse(init.body);
      }
      return nativeFetch(input, init);
    };
    const client = createNotionRestClient({
      accessToken: FAKE_NOTION_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
      apiVersion: "2026-03-11",
      apiHost: server.apiOrigin,
      fetchImpl,
    });
    await client.updatePage({ pageId: MOCK_PAGE_ID, inTrash: true });
    await server.close();
    expect(lastBody).toEqual({ in_trash: true });
  });

  it("sends position object on block append (not legacy after)", async () => {
    const server = await startMockNotionHttpServer();
    let lastBody: unknown;
    const nativeFetch = globalThis.fetch;
    const fetchImpl: typeof fetch = async (input, init) => {
      if (
        typeof input === "string" &&
        input.includes("/children") &&
        init?.method === "PATCH" &&
        typeof init.body === "string"
      ) {
        lastBody = JSON.parse(init.body);
      }
      return nativeFetch(input, init);
    };
    const client = createNotionRestClient({
      accessToken: FAKE_NOTION_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
      apiVersion: "2026-03-11",
      apiHost: server.apiOrigin,
      fetchImpl,
    });
    const afterId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    await client.appendBlockChildren({
      blockId: MOCK_BLOCK_ID,
      children: [{ paragraph: { rich_text: [] } }],
      position: { type: "after_block", afterBlockId: afterId },
    });
    await server.close();
    expect(lastBody).toMatchObject({
      position: {
        type: "after_block",
        after_block: { id: expect.any(String) },
      },
    });
    expect(lastBody).not.toHaveProperty("after");
  });
});
