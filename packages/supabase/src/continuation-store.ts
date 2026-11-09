import { randomUUID } from "node:crypto";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_CONTINUATION_TTL_MS,
  MAX_CONTINUATION_STORE_ENTRIES,
  MAX_CONTINUATION_TOKEN_LENGTH,
} from "./constants.js";

export type RowsListContinuationFamily = "table.rows.list";

export interface RowsListContinuationScope {
  readonly connectorKey: string;
  readonly family: RowsListContinuationFamily;
  readonly schema: string;
  readonly table: string;
  readonly pageSize: number;
  readonly filterFingerprint: string;
  readonly orderFingerprint: string;
}

export interface RowsListContinuationBinding extends RowsListContinuationScope {
  readonly offset: number;
}

interface StoredContinuationEntry extends RowsListContinuationBinding {
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

  issue(scope: RowsListContinuationScope, offset: number): string {
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
    this.entries.set(token, { ...scope, offset, issuedAtMs: now });
    return token;
  }

  resolve(
    continuationToken: string,
    expected: RowsListContinuationScope,
  ): number {
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
      binding.schema !== expected.schema ||
      binding.table !== expected.table ||
      binding.pageSize !== expected.pageSize ||
      binding.filterFingerprint !== expected.filterFingerprint ||
      binding.orderFingerprint !== expected.orderFingerprint
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Continuation token does not match the current list scope.",
      );
    }
    return binding.offset;
  }

  clear(): void {
    this.entries.clear();
  }
}
