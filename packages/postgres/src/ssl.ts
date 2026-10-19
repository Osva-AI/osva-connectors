import { z } from "zod";

export const postgresSslModeSchema = z.enum(["disable", "require", "verify"]);

export type PostgresSslMode = z.infer<typeof postgresSslModeSchema>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalPostgresHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return LOCAL_HOSTS.has(normalized);
}

/** Default TLS policy: verify remote hosts; disable TLS for typical local sockets. */
export function defaultSslModeForHost(host: string): PostgresSslMode {
  if (isLocalPostgresHost(host)) {
    return "disable";
  }
  return "verify";
}

export function parsePostgresSslMode(raw: string | undefined): PostgresSslMode {
  if (raw === undefined || raw.trim().length === 0) {
    throw new Error("missing");
  }
  const parsed = postgresSslModeSchema.safeParse(raw.trim().toLowerCase());
  if (!parsed.success) {
    throw new Error("unsupported");
  }
  return parsed.data;
}

/**
 * node-postgres `ssl` option. Modes are explicit — certificate verification is
 * never disabled unless `require` is selected.
 */
export function resolveNodePostgresSslOption(
  mode: PostgresSslMode,
): boolean | { rejectUnauthorized: boolean } {
  switch (mode) {
    case "disable":
      return false;
    case "require":
      // Explicit opt-in: encrypted but not verified (unsafe for production).
      return { rejectUnauthorized: false };
    case "verify":
      return { rejectUnauthorized: true };
  }
}
