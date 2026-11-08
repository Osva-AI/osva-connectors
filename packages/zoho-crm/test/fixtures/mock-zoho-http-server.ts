import http from "node:http";
import type { AddressInfo } from "node:net";
import { ZOHO_CRM_API_VERSION_PATH } from "../../src/constants.js";

export const FAKE_ZOHO_ACCESS_TOKEN = "zoho_fixture_token";
const DEAL_ID = "9001000000001001";
const LEAD_ID = "9001000000002001";
const ACCOUNT_ID = "9001000000003001";
const CONTACT_ID = "9001000000004001";

const DEAL = {
  id: DEAL_ID,
  Deal_Name: "Fixture Deal",
  Stage: "Qualification",
};

const STAGE_FIELDS = {
  fields: [
    {
      api_name: "Stage",
      pick_list_values: [
        { display_value: "Qualification", actual_value: "Qualification" },
        { display_value: "Closed Won", actual_value: "Closed Won" },
      ],
    },
  ],
};

function authOk(header: string | undefined): boolean {
  return header === `Zoho-oauthtoken ${FAKE_ZOHO_ACCESS_TOKEN}`;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export interface MockZohoHttpServer {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  getDealNotePostCount(): number;
  getLastDealNoteBody(): unknown;
  getDealStagePutCount(): number;
  getLastDealStagePutBody(): unknown;
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

function stripApiPrefix(pathname: string): string {
  const prefix = ZOHO_CRM_API_VERSION_PATH;
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length) || "/";
  }
  return pathname;
}

export async function startMockZohoHttpServer(): Promise<MockZohoHttpServer> {
  let dealNotePostCount = 0;
  let lastDealNoteBody: unknown;
  let dealStagePutCount = 0;
  let lastDealStagePutBody: unknown;
  const server = http.createServer(async (req, res) => {
    if (!authOk(req.headers.authorization)) {
      json(res, 401, { code: "AUTHENTICATION_FAILURE" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = stripApiPrefix(url.pathname);
    if (req.method === "GET" && path === "/Leads") {
      json(res, 200, {
        data: [{ id: LEAD_ID, Last_Name: "Lead" }],
        info: { more_records: false },
      });
      return;
    }
    if (req.method === "GET" && path === `/Leads/${LEAD_ID}`) {
      json(res, 200, { data: [{ id: LEAD_ID, Last_Name: "Lead" }] });
      return;
    }
    if (req.method === "GET" && path === "/Accounts") {
      json(res, 200, {
        data: [{ id: ACCOUNT_ID, Account_Name: "Account" }],
        info: { more_records: false },
      });
      return;
    }
    if (req.method === "GET" && path === `/Accounts/${ACCOUNT_ID}`) {
      json(res, 200, { data: [{ id: ACCOUNT_ID, Account_Name: "Account" }] });
      return;
    }
    if (req.method === "GET" && path === "/Contacts") {
      json(res, 200, {
        data: [{ id: CONTACT_ID, Last_Name: "Contact" }],
        info: { more_records: false },
      });
      return;
    }
    if (req.method === "GET" && path === `/Contacts/${CONTACT_ID}`) {
      json(res, 200, { data: [{ id: CONTACT_ID, Last_Name: "Contact" }] });
      return;
    }
    if (req.method === "GET" && path === "/Deals") {
      json(res, 200, {
        data: [DEAL],
        info: { more_records: false },
      });
      return;
    }
    if (req.method === "GET" && path === `/Deals/${DEAL_ID}`) {
      json(res, 200, { data: [DEAL] });
      return;
    }
    if (
      req.method === "GET" &&
      path === "/settings/fields" &&
      url.searchParams.get("module") === "Deals"
    ) {
      json(res, 200, STAGE_FIELDS);
      return;
    }
    if (req.method === "PUT" && path === `/Deals/${DEAL_ID}`) {
      dealStagePutCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastDealStagePutBody = JSON.parse(raw);
      } catch {
        lastDealStagePutBody = undefined;
      }
      json(res, 200, { data: [{ ...DEAL, Stage: "Closed Won" }] });
      return;
    }
    if (req.method === "POST" && path === `/Deals/${DEAL_ID}/Notes`) {
      dealNotePostCount += 1;
      const raw = await readRequestBody(req);
      try {
        lastDealNoteBody = JSON.parse(raw);
      } catch {
        lastDealNoteBody = undefined;
      }
      json(res, 201, { data: [{ id: "9001000000005001" }] });
      return;
    }
    json(res, 404, {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const pinnedOrigin = `http://127.0.0.1:${port}`;
  const apiBaseUrl = `${pinnedOrigin}${ZOHO_CRM_API_VERSION_PATH}`;
  return {
    apiBaseUrl,
    pinnedOrigin,
    getDealNotePostCount: () => dealNotePostCount,
    getLastDealNoteBody: () => lastDealNoteBody,
    getDealStagePutCount: () => dealStagePutCount,
    getLastDealStagePutBody: () => lastDealStagePutBody,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}

export const FIXTURE_DEAL_ID = DEAL_ID;
export const FIXTURE_LEAD_ID = LEAD_ID;
export const FIXTURE_ACCOUNT_ID = ACCOUNT_ID;
export const FIXTURE_CONTACT_ID = CONTACT_ID;
