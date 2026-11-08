import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_PIPEDRIVE_API_TOKEN = "pipedrive_fixture_token";

const DEAL = {
  id: 1001,
  title: "Fixture deal",
  status: "open",
  stage_id: 1,
  pipeline_id: 1,
};

const PERSON = {
  id: 10,
  name: "Jane Person",
  email: [{ value: "jane@example.test", primary: true }],
  phone: [{ value: "+1-555-0100", primary: true }],
  org_id: 20,
};

const ORGANIZATION = {
  id: 20,
  name: "Fixture Org",
  address: "123 Example St",
};

function authOk(header: string | undefined): boolean {
  return header === FAKE_PIPEDRIVE_API_TOKEN;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export interface MockPipedriveHttpServer {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  getStagePatchCount(): number;
  getLastStagePatchBody(): unknown;
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

export async function startMockPipedriveHttpServer(): Promise<MockPipedriveHttpServer> {
  let stagePatchCount = 0;
  let lastStagePatchBody: unknown;
  const server = http.createServer(async (req, res) => {
    const tokenHeader = req.headers["x-api-token"];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!authOk(token)) {
      json(res, 401, { success: false, error: "Unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/v2/pipelines") {
      json(res, 200, {
        success: true,
        data: [{ id: 1, name: "Sales", active: true, order_nr: 1 }],
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/stages") {
      json(res, 200, {
        success: true,
        data: [
          { id: 1, name: "Qualified", pipeline_id: 1, order_nr: 1 },
          { id: 2, name: "Proposal", pipeline_id: 1, order_nr: 2 },
        ],
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/deals") {
      json(res, 200, { success: true, data: [DEAL] });
      return;
    }
    if (req.method === "GET" && url.pathname === `/api/v2/deals/${DEAL.id}`) {
      json(res, 200, { success: true, data: DEAL });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/deals/search") {
      json(res, 200, {
        success: true,
        data: { items: [DEAL] },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/persons") {
      json(res, 200, { success: true, data: [PERSON] });
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/api/v2/persons/${PERSON.id}`
    ) {
      json(res, 200, { success: true, data: PERSON });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v2/organizations") {
      json(res, 200, { success: true, data: [ORGANIZATION] });
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === `/api/v2/organizations/${ORGANIZATION.id}`
    ) {
      json(res, 200, { success: true, data: ORGANIZATION });
      return;
    }
    if (req.method === "PATCH" && url.pathname === `/api/v2/deals/${DEAL.id}`) {
      stagePatchCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastStagePatchBody = JSON.parse(raw);
      } catch {
        lastStagePatchBody = undefined;
      }
      json(res, 200, {
        success: true,
        data: { ...DEAL, stage_id: 2 },
      });
      return;
    }
    json(res, 404, { success: false });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const pinnedOrigin = `http://127.0.0.1:${port}`;
  return {
    apiBaseUrl: `${pinnedOrigin}/api/v2`,
    pinnedOrigin,
    getStagePatchCount: () => stagePatchCount,
    getLastStagePatchBody: () => lastStagePatchBody,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
