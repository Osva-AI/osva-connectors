import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_FRESHDESK_API_KEY = "freshdesk_fixture_key";

const TICKET = {
  id: 1001,
  subject: "Fixture",
  status: 2,
  requester_id: 1,
};

function authOk(header: string | undefined): boolean {
  const expected = Buffer.from(`${FAKE_FRESHDESK_API_KEY}:X`, "utf8").toString(
    "base64",
  );
  return header === `Basic ${expected}`;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export interface MockFreshdeskHttpServer {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  getNotePostCount(): number;
  getLastNoteBody(): unknown;
  getStatusPutCount(): number;
  getLastStatusPutBody(): unknown;
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

export async function startMockFreshdeskHttpServer(): Promise<MockFreshdeskHttpServer> {
  let notePostCount = 0;
  let lastNoteBody: unknown;
  let statusPutCount = 0;
  let lastStatusPutBody: unknown;
  const server = http.createServer(async (req, res) => {
    if (!authOk(req.headers.authorization)) {
      json(res, 401, { message: "Unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/v2/tickets") {
      json(res, 200, [TICKET]);
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/api/v2/tickets/${TICKET.id}`
    ) {
      json(res, 200, TICKET);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/search/tickets") {
      json(res, 200, { results: [TICKET] });
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/api/v2/tickets/${TICKET.id}/conversations`
    ) {
      json(res, 200, [{ id: 1, body: "internal", private: true }]);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/contacts") {
      json(res, 200, [{ id: 10, name: "Contact" }]);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/contacts/10") {
      json(res, 200, { id: 10, name: "Contact" });
      return;
    }
    if (
      req.method === "POST" &&
      url.pathname === `/api/v2/tickets/${TICKET.id}/notes`
    ) {
      notePostCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastNoteBody = JSON.parse(raw);
      } catch {
        lastNoteBody = undefined;
      }
      json(res, 201, { id: 99 });
      return;
    }
    if (
      req.method === "PUT" &&
      url.pathname === `/api/v2/tickets/${TICKET.id}`
    ) {
      statusPutCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastStatusPutBody = JSON.parse(raw);
      } catch {
        lastStatusPutBody = undefined;
      }
      json(res, 200, { ...TICKET, status: 3 });
      return;
    }
    json(res, 404, {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const pinnedOrigin = `http://127.0.0.1:${port}`;
  return {
    apiBaseUrl: `${pinnedOrigin}/api/v2`,
    pinnedOrigin,
    getNotePostCount: () => notePostCount,
    getLastNoteBody: () => lastNoteBody,
    getStatusPutCount: () => statusPutCount,
    getLastStatusPutBody: () => lastStatusPutBody,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
