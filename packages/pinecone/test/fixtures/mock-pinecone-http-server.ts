import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_PINECONE_API_KEY =
  "pinecone_fixture_key_0123456789abcdef0123456789abcd";

export interface MockPineconeHttpServer {
  readonly controlPlaneOrigin: string;
  readonly dataHost: string;
  getLastApiKey(): string | undefined;
  getLastApiVersion(): string | undefined;
  getRequestCount(): number;
  getLastPathname(): string | undefined;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function startMockPineconeHttpServer(
  expectedApiKey: string = FAKE_PINECONE_API_KEY,
): Promise<MockPineconeHttpServer> {
  let lastApiKey: string | undefined;
  let lastApiVersion: string | undefined;
  let lastPathname: string | undefined;
  let requestCount = 0;

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastApiKey = req.headers["api-key"] as string | undefined;
    lastApiVersion = req.headers["x-pinecone-api-version"] as
      string | undefined;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    lastPathname = url.pathname;

    if (expectedApiKey.length > 0 && lastApiKey !== expectedApiKey) {
      jsonResponse(res, 401, { message: "Invalid API key" });
      return;
    }

    const address = server.address() as AddressInfo;
    const dataHost = `127.0.0.1:${address.port}`;

    if (req.method === "GET" && url.pathname === "/indexes") {
      jsonResponse(res, 200, {
        indexes: [
          { name: "docs", host: dataHost, vector_type: "dense" },
          { name: "sparse-index", host: dataHost, vector_type: "sparse" },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/indexes/docs") {
      jsonResponse(res, 200, {
        name: "docs",
        host: dataHost,
        dimension: 3,
        metric: "cosine",
        vector_type: "dense",
        spec: { serverless: { cloud: "aws", region: "us-east-1" } },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/indexes/sparse-index") {
      jsonResponse(res, 200, {
        name: "sparse-index",
        host: dataHost,
        vector_type: "sparse",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/indexes/pod-index") {
      jsonResponse(res, 200, {
        name: "pod-index",
        host: dataHost,
        dimension: 3,
        vector_type: "dense",
        spec: { pod: { environment: "us-east-1-aws", pod_type: "p1.x1" } },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/indexes/embed-index") {
      jsonResponse(res, 200, {
        name: "embed-index",
        host: dataHost,
        vector_type: "dense",
        spec: { embed: { model: "multilingual-e5-large" } },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/describe_index_stats") {
      jsonResponse(res, 200, {
        namespaces: { "": { vectorCount: 10 } },
        dimension: 3,
        indexFullness: 0.1,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/query") {
      jsonResponse(res, 200, {
        matches: [{ id: "v1", score: 0.99, metadata: { title: "match" } }],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/vectors/fetch") {
      jsonResponse(res, 200, {
        vectors: { v1: { id: "v1", values: [0.1, 0.2, 0.3] } },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/vectors/list") {
      jsonResponse(res, 200, {
        vectors: [{ id: "v1" }],
        pagination: { next: "token-2" },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/vectors/upsert") {
      jsonResponse(res, 200, { upsertedCount: 1 });
      return;
    }

    jsonResponse(res, 404, { message: "Not found" });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  const controlPlaneOrigin = `http://127.0.0.1:${address.port}`;
  const dataHost = `127.0.0.1:${address.port}`;

  return {
    controlPlaneOrigin,
    dataHost,
    getLastApiKey: () => lastApiKey,
    getLastApiVersion: () => lastApiVersion,
    getRequestCount: () => requestCount,
    getLastPathname: () => lastPathname,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
