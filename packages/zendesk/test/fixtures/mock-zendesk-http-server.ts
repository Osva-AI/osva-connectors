import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_ZENDESK_EMAIL = "agent@example.test";
export const FAKE_ZENDESK_API_TOKEN = "zendesk_fixture_token";

const TICKET = {
  id: 1001,
  status: "open",
  subject: "Fixture ticket",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  requester_id: 42,
  organization_id: 7,
  priority: "normal",
};

const USER = {
  id: 42,
  name: "Fixture User",
  email: "user@example.test",
  role: "end-user",
};

function expectedAuth(): string {
  const token = Buffer.from(
    `${FAKE_ZENDESK_EMAIL}/token:${FAKE_ZENDESK_API_TOKEN}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export interface MockZendeskHttpServer {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  getTicketPutCount(): number;
  getLastTicketPutBody(): unknown;
  close(): Promise<void>;
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function startMockZendeskHttpServer(): Promise<MockZendeskHttpServer> {
  const expected = expectedAuth();
  let ticketPutCount = 0;
  let lastTicketPutBody: unknown;
  const server = http.createServer(async (req, res) => {
    if (req.headers.authorization !== expected) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/v2/tickets.json") {
      json(res, 200, {
        tickets: [TICKET],
        meta: { has_more: false },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/search.json") {
      json(res, 200, { results: [{ ...TICKET }] });
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/api/v2/tickets/${TICKET.id}.json`
    ) {
      json(res, 200, { ticket: TICKET });
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/api/v2/tickets/${TICKET.id}/comments.json`
    ) {
      json(res, 200, {
        comments: [
          {
            id: 1,
            public: false,
            body: "Internal note",
            author_id: 1,
            created_at: "2024-01-01T01:00:00Z",
          },
          {
            id: 2,
            public: true,
            body: "Customer reply",
            author_id: 42,
            created_at: "2024-01-01T02:00:00Z",
          },
        ],
      });
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/api/v2/users/${USER.id}.json`
    ) {
      json(res, 200, { user: USER });
      return;
    }
    if (
      req.method === "PUT" &&
      url.pathname === `/api/v2/tickets/${TICKET.id}.json`
    ) {
      ticketPutCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastTicketPutBody = JSON.parse(raw);
      } catch {
        lastTicketPutBody = undefined;
      }
      json(res, 200, { ticket: { ...TICKET, status: "pending" } });
      return;
    }
    json(res, 404, { error: "Not found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const pinnedOrigin = `http://127.0.0.1:${port}`;
  return {
    apiBaseUrl: `${pinnedOrigin}/api/v2`,
    pinnedOrigin,
    getTicketPutCount: () => ticketPutCount,
    getLastTicketPutBody: () => lastTicketPutBody,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
