import http from "node:http";

export interface MockSupabaseHttpServer {
  readonly port: number;
  readonly projectUrl: string;
  readonly pinnedOrigin: string;
  readonly restBaseUrl: string;
  close(): Promise<void>;
}

const OPENAPI = {
  paths: {
    "/users": {
      get: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { items: { $ref: "#/definitions/users" } },
              },
            },
          },
        },
      },
      "x-db-schema": "public",
    },
  },
  definitions: {
    users: {
      type: "object",
      required: ["id", "email"],
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string" },
        name: { type: "string" },
      },
    },
  },
};

export async function startMockSupabaseHttpServer(): Promise<MockSupabaseHttpServer> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/rest/v1/") {
      res.writeHead(200, { "content-type": "application/openapi+json" });
      res.end(JSON.stringify(OPENAPI));
      return;
    }
    if (req.method === "GET" && url.pathname === "/rest/v1/users") {
      const select = url.searchParams.get("select");
      if (select === "*") {
        res.writeHead(400).end();
        return;
      }
      const range = req.headers.range;
      const start = range ? Number(range.split("-")[0]) : 0;
      const rows = [
        { id: "1", email: "a@example.com", name: "Ada" },
        { id: "2", email: "b@example.com", name: "Bob" },
      ];
      const limit = 20;
      const slice = rows.slice(start, start + limit);
      const end = slice.length === 0 ? start - 1 : start + slice.length - 1;
      res.writeHead(200, {
        "content-type": "application/json",
        "content-range": `${start}-${end}/${rows.length}`,
      });
      res.end(JSON.stringify(slice));
      return;
    }
    if (req.method === "HEAD" && url.pathname === "/rest/v1/users") {
      const prefer = req.headers.prefer ?? "";
      const exact = String(prefer).includes("count=exact");
      res.writeHead(200, {
        "content-range": `0-${exact ? 1 : 0}/2`,
      });
      res.end();
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to bind mock Supabase server.");
  }
  const port = address.port;
  const pinnedOrigin = `http://127.0.0.1:${port}`;
  return {
    port,
    projectUrl: pinnedOrigin,
    pinnedOrigin,
    restBaseUrl: `${pinnedOrigin}/rest/v1`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
