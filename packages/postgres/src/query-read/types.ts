export interface ReadOnlySelectExecutionOptions {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly maxRows: number;
  readonly statementTimeoutMs: number;
  readonly lockTimeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface ReadOnlySelectExecutionResult {
  readonly columns: ReadonlyArray<{ name: string; dataType: string }>;
  readonly rows: unknown[][];
  readonly rowCount: number;
  readonly truncated: boolean;
}
