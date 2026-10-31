import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertAllowedNpmUrl,
  createNpmClient,
  normalizeDownloadsDocument,
  normalizeRegistryDocument,
} from "../src/npm-client.js";
import { NPM_DOWNLOADS_ORIGIN, NPM_REGISTRY_ORIGIN } from "../src/constants.js";
import {
  createMockNpmFetch,
  downloadsUrlFor,
  registryUrlFor,
} from "./fixtures/mock-npm-fetch.js";

describe("npm client", () => {
  it("fetches normalized package metadata", async () => {
    const client = createNpmClient({ fetch: createMockNpmFetch() });
    const metadata = await client.fetchPackageMetadata("lodash");
    expect(metadata.latestVersion).toBe("4.17.21");
    expect(metadata.license).toBe("MIT");
  });

  it("fetches scoped package metadata", async () => {
    const client = createNpmClient({ fetch: createMockNpmFetch() });
    const metadata = await client.fetchPackageMetadata("@types/node");
    expect(metadata.name).toBe("@types/node");
  });

  it("fetches download statistics for last-month", async () => {
    const client = createNpmClient({ fetch: createMockNpmFetch() });
    const stats = await client.fetchDownloads("lodash", "last-month");
    expect(stats.downloads).toBe(50_000_000);
    expect(stats.period).toBe("last-month");
  });

  it("maps registry 404 to PACKAGE_NOT_FOUND", async () => {
    const client = createNpmClient({ fetch: createMockNpmFetch() });
    await expect(
      client.fetchPackageMetadata("missing-pkg"),
    ).rejects.toMatchObject({ code: "PACKAGE_NOT_FOUND" });
  });

  it("maps npm 429 to rate limit errors", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: "rate" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    const client = createNpmClient({ fetch: fetchImpl });
    await expect(client.fetchPackageMetadata("lodash")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("times out slow upstream responses", async () => {
    const client = createNpmClient({
      fetch: createMockNpmFetch({ delayMs: 200 }),
      timeoutMs: 50,
    });
    await expect(client.fetchPackageMetadata("lodash")).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("rejects oversized responses", async () => {
    const client = createNpmClient({
      fetch: createMockNpmFetch({ oversizedBodyBytes: 512 }),
      maxResponseBytes: 256,
    });
    await expect(client.fetchPackageMetadata("lodash")).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("restricts outbound hosts", () => {
    expect(() =>
      assertAllowedNpmUrl(new URL("https://evil.example/npm")),
    ).toThrow(ConnectorSdkError);
    expect(() => assertAllowedNpmUrl(registryUrlFor("lodash"))).not.toThrow();
    expect(() => assertAllowedNpmUrl(downloadsUrlFor("lodash"))).not.toThrow();
  });

  it("uses redirect error mode and official origins only", async () => {
    const seen: URL[] = [];
    const client = createNpmClient({
      fetch: createMockNpmFetch({
        onRequest: (url) => {
          seen.push(url);
        },
      }),
    });
    await client.fetchPackageMetadata("lodash");
    expect(seen[0]?.origin).toBe(NPM_REGISTRY_ORIGIN);
    await client.fetchDownloads("lodash", "last-month");
    expect(seen[1]?.origin).toBe(NPM_DOWNLOADS_ORIGIN);
  });

  it("normalizes registry and downloads documents", () => {
    const metadata = normalizeRegistryDocument("lodash", {
      name: "lodash",
      "dist-tags": { latest: "1.0.0" },
    });
    expect(metadata.latestVersion).toBe("1.0.0");

    const downloads = normalizeDownloadsDocument("lodash", "last-month", {
      downloads: 10,
      start: "2020-01-01",
      end: "2020-02-01",
      package: "lodash",
    });
    expect(downloads.downloads).toBe(10);
  });
});
