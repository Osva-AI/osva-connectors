import type { FetchLike } from "../../src/npm-client.js";
import {
  NPM_DOWNLOADS_ORIGIN,
  NPM_REGISTRY_ORIGIN,
} from "../../src/constants.js";
import { NPM_DOWNLOADS_PERIOD_LAST_MONTH } from "../../src/schemas.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const REGISTRY_FIXTURES: Record<string, unknown> = {
  lodash: {
    name: "lodash",
    "dist-tags": { latest: "4.17.21" },
    license: "MIT",
    repository: { url: "git+https://github.com/lodash/lodash.git" },
    time: { "4.17.21": "2021-02-20T00:00:00.000Z" },
    maintainers: [{ name: "a" }],
  },
  "@types/node": {
    name: "@types/node",
    "dist-tags": { latest: "24.0.0" },
    license: "MIT",
    time: { "24.0.0": "2026-01-01T00:00:00.000Z" },
  },
};

const DOWNLOADS_FIXTURES: Record<string, unknown> = {
  lodash: {
    downloads: 50_000_000,
    start: "2026-02-01",
    end: "2026-02-28",
    package: "lodash",
  },
  "@types/node": {
    downloads: 12_000_000,
    start: "2026-02-01",
    end: "2026-02-28",
    package: "@types/node",
  },
};

export interface MockNpmFetchOptions {
  readonly onRequest?: (url: URL) => void;
  readonly delayMs?: number;
  readonly oversizedBodyBytes?: number;
}

export function createMockNpmFetch(
  options: MockNpmFetchOptions = {},
): FetchLike {
  return async (input, init) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);

    options.onRequest?.(url);

    if (options.delayMs !== undefined && options.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), options.delayMs);
        const signal = init?.signal ?? undefined;
        if (signal != null) {
          if (signal.aborted) {
            clearTimeout(timer);
            reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(
                signal.reason ?? new DOMException("Aborted", "AbortError"),
              );
            },
            { once: true },
          );
        }
      });
    }

    if (
      init?.redirect === "error" &&
      url.searchParams.get("redirect") === "1"
    ) {
      throw new TypeError("redirect");
    }

    if (url.origin === NPM_REGISTRY_ORIGIN) {
      const encoded = url.pathname.slice(1);
      const packageName = decodeURIComponent(encoded);
      const fixture = REGISTRY_FIXTURES[packageName];
      if (fixture === undefined) {
        return jsonResponse(404, { error: "Not found" });
      }
      if (options.oversizedBodyBytes !== undefined) {
        const pad = "x".repeat(options.oversizedBodyBytes);
        return jsonResponse(200, { ...fixture, pad });
      }
      return jsonResponse(200, fixture);
    }

    if (url.origin === NPM_DOWNLOADS_ORIGIN) {
      const match = url.pathname.match(
        /^\/downloads\/point\/last-month\/(.+)$/,
      );
      if (match?.[1] === undefined) {
        return jsonResponse(404, { error: "Not found" });
      }
      const packageName = decodeURIComponent(match[1]);
      const fixture = DOWNLOADS_FIXTURES[packageName];
      if (fixture === undefined) {
        return jsonResponse(404, { error: "Not found" });
      }
      if (options.oversizedBodyBytes !== undefined) {
        return new Response("x".repeat(options.oversizedBodyBytes), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return jsonResponse(200, fixture);
    }

    return jsonResponse(502, { error: "unexpected host" });
  };
}

export function registryUrlFor(packageName: string): URL {
  return new URL(
    `/${encodeURIComponent(packageName)}`,
    `${NPM_REGISTRY_ORIGIN}/`,
  );
}

export function downloadsUrlFor(packageName: string): URL {
  return new URL(
    `/downloads/point/${NPM_DOWNLOADS_PERIOD_LAST_MONTH}/${encodeURIComponent(packageName)}`,
    `${NPM_DOWNLOADS_ORIGIN}/`,
  );
}
