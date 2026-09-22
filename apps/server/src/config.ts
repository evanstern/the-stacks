/** Server configuration, read from environment variables. */
export interface ServerConfig {
  /** Postgres connection string, e.g. postgres://user:pass@host:5432/db */
  databaseUrl: string;
  /** Port the HTTP server binds to. */
  port: number;
}

/**
 * Reads configuration from environment variables.
 * Throws if a required variable is missing.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const portRaw = env.PORT ?? "3000";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got "${portRaw}"`);
  }

  return { databaseUrl, port };
}
