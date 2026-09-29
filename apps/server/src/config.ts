// No relative imports in this file. scripts/migrate.ts runs it on the host
// under `node --experimental-strip-types`, which cannot follow src/'s
// .js-suffixed imports (see the comment at the top of that script) —
// checked by `pnpm check:host-scripts`.

/** Server configuration, read from environment variables. */
export interface ServerConfig {
  /** Postgres connection string, e.g. postgres://user:pass@host:5432/db */
  databaseUrl: string;
  /** Port the HTTP server binds to. */
  port: number;
  /** Git commit the running build came from (GIT_COMMIT build arg); "unknown" if unset. */
  commit: string;
  /** Ceiling on a single upload's file-part size, in bytes (UPLOAD_MAX_BYTES). */
  uploadMaxBytes: number;
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

  const portRaw = env.APP_PORT ?? "3000";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`APP_PORT must be a positive integer, got "${portRaw}"`);
  }

  const commit = env.GIT_COMMIT ?? "unknown";

  const uploadMaxBytesRaw = env.UPLOAD_MAX_BYTES ?? "1073741824";
  const uploadMaxBytes = Number(uploadMaxBytesRaw);
  if (!Number.isInteger(uploadMaxBytes) || uploadMaxBytes <= 0) {
    throw new Error(
      `UPLOAD_MAX_BYTES must be a positive integer, got "${uploadMaxBytesRaw}"`,
    );
  }

  return { databaseUrl, port, commit, uploadMaxBytes };
}
