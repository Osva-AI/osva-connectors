/** Strip URL ssl/sslmode query params so pool `ssl` is the single source of truth. */
const STRIPPED_URL_SSL_PARAMS = [
  "ssl",
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
];

export interface ParsedPostgresConnectionUrl {
  readonly host: string;
  /** Connection string without URL-level SSL parameters. */
  readonly connectionString: string;
}

export function parsePostgresConnectionUrl(
  connectionUrl: string,
): ParsedPostgresConnectionUrl {
  const parsed = new URL(connectionUrl);
  for (const param of STRIPPED_URL_SSL_PARAMS) {
    parsed.searchParams.delete(param);
  }
  const host = parsed.hostname;
  if (host.length === 0) {
    throw new Error("Host is required in the connection URL.");
  }
  return {
    host,
    connectionString: parsed.toString(),
  };
}
