import { randomUUID } from "node:crypto";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_CONTINUATION_TTL_MS,
  MAX_CONTINUATION_STORE_ENTRIES,
  MAX_CONTINUATION_TOKEN_LENGTH,
} from "./constants.js";

export type ListToolFamily =
  "schema.list" | "table.list" | "table.columns.list" | "table.rows.sample";

export interface ContinuationScope {
  readonly connectorKey: string;
  readonly family: ListToolFamily;
  readonly schema?: string;
  readonly table?: string;
  readonly pageSize: number;
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
      throw new ConnectorSdkError("INTERNAL", "Continuation token too long.");
    }
    this.evictIfAtCapacity();
    this.entries.set(token, {
      ...scope,
      providerToken,
      issuedAtMs: now,
    });
    return token;
  }

  resolve(token: string, scope: ContinuationScope): string {
    const now = this.clock.now();
    this.deleteExpiredEntries(now);
    const entry = this.entries.get(token);
    if (entry === undefined) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token is invalid or expired.",
      );
    }
    if (this.isExpired(entry, now)) {
      this.entries.delete(token);
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token is invalid or expired.",
      );
    }
    if (
      entry.connectorKey !== scope.connectorKey ||
      entry.family !== scope.family ||
      entry.pageSize !== scope.pageSize ||
      entry.schema !== scope.schema ||
      entry.table !== scope.table
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token does not match this list request.",
      );
    }
    this.entries.delete(token);
    return entry.providerToken;
  }
}
