import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_SALESFORCE_ACCESS_TOKEN = "salesforce_fixture_token";
export const API_VERSION = "v59.0";
export const FIXTURE_ACCOUNT_ID = "001000000000001AAA";
export const FIXTURE_CONTACT_ID = "003000000000001AAA";
export const FIXTURE_OPPORTUNITY_ID = "006000000000001AAA";
export const ACCOUNT_LOCATOR = "/query/01gACCOUNTS0001-200";

const ACCOUNT = {
  Id: FIXTURE_ACCOUNT_ID,
  Name: "Fixture Account",
  Type: "Customer",
  Industry: "Technology",
  CreatedDate: "2026-01-01T00:00:00.000Z",
};

const ACCOUNT_PAGE_2 = {
  Id: "001000000000002AAA",
  Name: "Fixture Account 2",
  Type: "Customer",
  Industry: "Finance",
  CreatedDate: "2026-01-02T00:00:00.000Z",
};

const CONTACT = {
  Id: FIXTURE_CONTACT_ID,
  FirstName: "Fixture",
  LastName: "Contact",
  Name: "Fixture Contact",
  Email: "contact@fixture.test",
  Phone: "+15550100",
  CreatedDate: "2026-01-01T00:00:00.000Z",
};

const OPPORTUNITY = {
  Id: FIXTURE_OPPORTUNITY_ID,
  Name: "Fixture Opportunity",
  StageName: "Prospecting",
  Amount: 1000,
  CloseDate: "2026-12-31",
  LastModifiedDate: "2026-06-01T00:00:00.000Z",
};

const STAGES = {
  records: [
    {
      MasterLabel: "Prospecting",
      ApiName: "Prospecting",
      IsActive: true,
      IsClosed: false,
      IsWon: false,
      SortOrder: 1,
    },
    {
      MasterLabel: "Closed Won",
      ApiName: "Closed Won",
      IsActive: true,
      IsClosed: true,
      IsWon: true,
      SortOrder: 2,
    },
  ],
  done: true,
  totalSize: 2,
};

function authOk(header: string | undefined): boolean {
  return header === `Bearer ${FAKE_SALESFORCE_ACCESS_TOKEN}`;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export interface MockSalesforceHttpServer {
  readonly instanceUrl: string;
  readonly pinnedOrigin: string;
  readonly apiDataBaseUrl: string;
  getStagePatchCount(): number;
  getLastStagePatchBody(): unknown;
  getTaskPostCount(): number;
  getLastTaskBody(): unknown;
  getLocatorFetchCount(): number;
  close(): Promise<void>;
}

export async function startMockSalesforceHttpServer(): Promise<MockSalesforceHttpServer> {
  let stagePatchCount = 0;
  let lastStagePatchBody: unknown;
  let taskPostCount = 0;
  let lastTaskBody: unknown;
  let locatorFetchCount = 0;

  const server = http.createServer(async (req, res) => {
    const requestOrigin = `http://${req.headers.host ?? "127.0.0.1"}`;
    if (!authOk(req.headers.authorization)) {
      json(res, 401, [
        { message: "Unauthorized", errorCode: "INVALID_SESSION_ID" },
      ]);
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const prefix = `/services/data/${API_VERSION}`;
    if (!url.pathname.startsWith(prefix)) {
      json(res, 404, []);
      return;
    }
    const subPath = url.pathname.slice(prefix.length) || "/";

    if (req.method === "GET" && subPath === ACCOUNT_LOCATOR) {
      locatorFetchCount += 1;
      json(res, 200, {
        totalSize: 2,
        done: true,
        records: [ACCOUNT_PAGE_2],
      });
      return;
    }

    if (req.method === "GET" && subPath === "/query/locator-expired") {
      json(res, 400, [
        {
          message: "expired",
          errorCode: "INVALID_QUERY_LOCATOR",
        },
      ]);
      return;
    }

    if (req.method === "GET" && subPath === "/query/locator-invalid") {
      json(res, 404, [{ message: "not found", errorCode: "NOT_FOUND" }]);
      return;
    }

    if (req.method === "GET" && subPath.startsWith("/query/")) {
      json(res, 404, []);
      return;
    }

    if (req.method === "GET" && subPath === "/query") {
      const q = url.searchParams.get("q") ?? "";
      if (q.includes("FROM Account")) {
        if (q.includes("LIMIT 1") && !q.includes("001000000000002")) {
          json(res, 200, {
            totalSize: 2,
            done: false,
            records: [ACCOUNT],
            nextRecordsUrl: `${requestOrigin}${prefix}${ACCOUNT_LOCATOR}`,
          });
          return;
        }
        json(res, 200, {
          totalSize: 1,
          done: true,
          records: [ACCOUNT],
        });
        return;
      }
      if (q.includes("FROM Contact")) {
        json(res, 200, { totalSize: 1, done: true, records: [CONTACT] });
        return;
      }
      if (q.includes("FROM Opportunity")) {
        json(res, 200, { totalSize: 1, done: true, records: [OPPORTUNITY] });
        return;
      }
      if (q.includes("FROM OpportunityStage")) {
        json(res, 200, STAGES);
        return;
      }
      json(res, 400, [
        { message: "invalid query", errorCode: "MALFORMED_QUERY" },
      ]);
      return;
    }

    if (
      req.method === "GET" &&
      subPath === `/sobjects/Account/${FIXTURE_ACCOUNT_ID}`
    ) {
      json(res, 200, ACCOUNT);
      return;
    }
    if (
      req.method === "GET" &&
      subPath === `/sobjects/Contact/${FIXTURE_CONTACT_ID}`
    ) {
      json(res, 200, CONTACT);
      return;
    }
    if (
      req.method === "GET" &&
      subPath === `/sobjects/Opportunity/${FIXTURE_OPPORTUNITY_ID}`
    ) {
      json(res, 200, OPPORTUNITY);
      return;
    }
    if (
      req.method === "PATCH" &&
      subPath === `/sobjects/Opportunity/${FIXTURE_OPPORTUNITY_ID}`
    ) {
      stagePatchCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastStagePatchBody = JSON.parse(raw);
      } catch {
        lastStagePatchBody = undefined;
      }
      json(res, 204, null);
      return;
    }
    if (req.method === "POST" && subPath === "/sobjects/Task") {
      taskPostCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastTaskBody = JSON.parse(raw);
      } catch {
        lastTaskBody = undefined;
      }
      json(res, 201, { id: "00T000000000001AAA", success: true });
      return;
    }

    json(res, 404, []);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const pinnedOrigin = `http://127.0.0.1:${port}`;
  const instanceUrl = pinnedOrigin;
  return {
    instanceUrl,
    pinnedOrigin,
    apiDataBaseUrl: `${instanceUrl}/services/data/${API_VERSION}`,
    getStagePatchCount: () => stagePatchCount,
    getLastStagePatchBody: () => lastStagePatchBody,
    getTaskPostCount: () => taskPostCount,
    getLastTaskBody: () => lastTaskBody,
    getLocatorFetchCount: () => locatorFetchCount,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
