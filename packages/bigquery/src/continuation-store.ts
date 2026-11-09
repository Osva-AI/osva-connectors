import { randomUUID } from "node:crypto";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_CONTINUATION_TTL_MS,
  MAX_CONTINUATION_STORE_ENTRIES,
  MAX_CONTINUATION_TOKEN_LENGTH,
} from "./constants.js";

export type RowsSampleFamily = "table.rows.sample";

export interface ContinuationScope {
  readonly connectorKey: string;
  readonly family: RowsSampleFamily;
  readonly datasetId: string;
  readonly tableId: string;
  readonly pageSize: number;
  readonly queryFingerprint: string;
}

export interface ContinuationBinding extends ContinuationScope {
  readonly providerToken: string;
}

interface StoredContinuationEntry extends ContinuationBinding {
  readonly issuedAtMs: number;
}

export interface ContinuationClock {
  now(): number;
}

export interface ContinuationStoreOptions {
  readonly clock?: ContinuationClock;
  readonly ttlMs?: number;
}

export class ContinuationStore {
  private readonly entries = new Map<string, StoredContinuationEntry>();
  private readonly clock: ContinuationClock;
  private readonly ttlMs: number;

  constructor(options?: ContinuationStoreOptions) {
    this.clock = options?.clock ?? { now: () => Date.now() };
    this.ttlMs = options?.ttlMs ?? DEFAULT_CONTINUATION_TTL_MS;
  }

  get entryCount(): number {
    return this.entries.size;
  }

  private isExpired(entry: StoredContinuationEntry, now: number): boolean {
    return now - entry.issuedAtMs > this.ttlMs;
  }

  private deleteExpiredEntries(now: number): void {
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry, now)) {
        this.entries.delete(key);
      }
    }
  }

  private evictIfAtCapacity(): void {
    if (this.entries.size < MAX_CONTINUATION_STORE_ENTRIES) {
      return;
    }
    const oldest = this.entries.keys().next().value;
    if (oldest !== undefined) {
      this.entries.delete(oldest);
    }
  }

  issue(scope: ContinuationScope, providerToken: string): string {
    const now = this.clock.now();
    this.deleteExpiredEntries(now);

    const token = randomUUID();
    if (token.length > MAX_CONTINUATION_TOKEN_LENGTH) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Failed to issue continuation token.",
      );
    }
    this.evictIfAtCapacity();
    this.entries.set(token, { ...scope, providerToken, issuedAtMs: now });
    return token;
  }

  resolve(continuationToken: string, expected: ContinuationScope): string {
    const trimmed = continuationToken.trim();
    if (
      trimmed.length === 0 ||
      trimmed.length > MAX_CONTINUATION_TOKEN_LENGTH
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token is invalid.",
      );
    }

    const now = this.clock.now();
    const binding = this.entries.get(trimmed);
    if (binding === undefined) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token is invalid or expired.",
      );
    }
    if (this.isExpired(binding, now)) {
      this.entries.delete(trimmed);
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token is invalid or expired.",
      );
    }
    if (
      binding.connectorKey !== expected.connectorKey ||
      binding.family !== expected.family ||
      binding.datasetId !== expected.datasetId ||
      binding.tableId !== expected.tableId ||
      binding.pageSize !== expected.pageSize ||
      binding.queryFingerprint !== expected.queryFingerprint
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token does not match the current query scope.",
      );
    }
    return binding.providerToken;
  }

  clear(): void {
    this.entries.clear();
  }
}

export function queryFingerprint(
  sql: string,
  params: Record<string, unknown>,
): string {
  return JSON.stringify({ sql, params });
}
