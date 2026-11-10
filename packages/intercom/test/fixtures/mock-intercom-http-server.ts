import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_INTERCOM_ACCESS_TOKEN = "intercom_fixture_token";
const CONVERSATION_ID = "conv_fixture_1001";

const CONVERSATION = {
  id: CONVERSATION_ID,
  title: "Fixture",
  state: "open",
};

function authOk(header: string | undefined): boolean {
  return header === `Bearer ${FAKE_INTERCOM_ACCESS_TOKEN}`;
}

function versionOk(header: string | string[] | undefined): boolean {
  if (Array.isArray(header)) {
    return header.includes("2.17");
  }
  return header === "2.17";
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export interface MockIntercomHttpServer {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  getAdminNotePostCount(): number;
  getLastAdminNoteBody(): unknown;
  getStatePutCount(): number;
  getLastStatePutBody(): unknown;
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

export async function startMockIntercomHttpServer(): Promise<MockIntercomHttpServer> {
  let adminNotePostCount = 0;
  let lastAdminNoteBody: unknown;
  let statePutCount = 0;
  let lastStatePutBody: unknown;
  const server = http.createServer(async (req, res) => {
    if (
      !authOk(req.headers.authorization) ||
      !versionOk(req.headers["intercom-version"])
    ) {
      json(res, 401, { message: "Unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/conversations") {
      json(res, 200, { conversations: [CONVERSATION] });
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/conversations/${CONVERSATION_ID}`
    ) {
      json(res, 200, CONVERSATION);
      return;
    }
    if (req.method === "POST" && url.pathname === "/conversations/search") {
      json(res, 200, { conversations: [CONVERSATION] });
      return;
    }
    if (req.method === "GET" && url.pathname === "/contacts") {
      json(res, 200, { data: [{ id: "contact_10", name: "Contact" }] });
      return;
    }
    if (req.method === "GET" && url.pathname === "/contacts/contact_10") {
      json(res, 200, { id: "contact_10", name: "Contact" });
      return;
    }
    if (req.method === "POST" && url.pathname === "/contacts/search") {
      json(res, 200, { data: [{ id: "contact_10" }] });
      return;
    }
    if (req.method === "GET" && url.pathname === "/admins") {
      json(res, 200, [{ id: "admin_1", name: "Admin" }]);
      return;
    }
    if (
      req.method === "POST" &&
      url.pathname === `/conversations/${CONVERSATION_ID}/reply`
    ) {
      adminNotePostCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastAdminNoteBody = JSON.parse(raw);
      } catch {
        lastAdminNoteBody = undefined;
      }
      json(res, 200, { id: "part_1" });
      return;
    }
    if (
      req.method === "POST" &&
      url.pathname === `/conversations/${CONVERSATION_ID}/parts`
    ) {
      statePutCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastStatePutBody = JSON.parse(raw);
      } catch {
        lastStatePutBody = undefined;
      }
      json(res, 200, { ...CONVERSATION, state: "closed" });
      return;
    }
    json(res, 404, {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const pinnedOrigin = `http://127.0.0.1:${port}`;
  return {
    apiBaseUrl: pinnedOrigin,
    pinnedOrigin,
    getAdminNotePostCount: () => adminNotePostCount,
    getLastAdminNoteBody: () => lastAdminNoteBody,
    getStatePutCount: () => statePutCount,
    getLastStatePutBody: () => lastStatePutBody,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
