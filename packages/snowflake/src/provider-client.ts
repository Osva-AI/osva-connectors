export interface SnowflakeColumnMeta {
  readonly name: string;
  readonly dataType?: string;
  readonly nullable?: boolean;
}

export interface SnowflakeQueryResult {
  readonly columns: readonly SnowflakeColumnMeta[];
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
}

export interface SnowflakeExecuteOptions {
  readonly sqlText: string;
  readonly binds: readonly (string | number | boolean | null)[];
  readonly timeoutMs: number;
  readonly maxRows: number;
  readonly signal?: AbortSignal;
}

export interface SnowflakeProviderClient {
  execute(options: SnowflakeExecuteOptions): Promise<SnowflakeQueryResult>;
  destroy(): Promise<void>;
}
