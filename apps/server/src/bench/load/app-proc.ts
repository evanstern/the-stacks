import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Spawns the built app as a child process against a given database
 * (specs/021-load-bench T014, research R7/R8) — used by `concurrency-local`
 * and `db-exhaustion`. Never the worktree's own app container: this is a
 * throwaway process against the isolated load database.
 */

const APP_ENTRY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../index.js",
);

/** Binds port 0 to find a free port, then closes it (a small TOCTOU window is acceptable for a local bench). */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function gitCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

export interface StartAppInput {
  databaseUrl: string;
}

export interface StartedApp {
  url: string;
  pid: number;
  alive(): boolean;
  stop(): Promise<void>;
}

/** Starts `node dist/index.js` against `databaseUrl` on a free port and waits for `/health` `ok`. */
export async function startApp({
  databaseUrl,
}: StartAppInput): Promise<StartedApp> {
  const port = await freePort();
  const child = spawn(process.execPath, [APP_ENTRY], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      APP_PORT: String(port),
      GIT_COMMIT: gitCommit(),
      // A fake, keyless provider (research R7/R8) — concurrency and
      // exhaustion cases never embed anything.
      AI_PROVIDERS: JSON.stringify({
        fake: { kind: "fake", baseUrl: "http://fake/load-bench" },
      }),
      AI_PURPOSES: JSON.stringify({
        embedding: { provider: "fake", model: "fake-embed-1", op: "embed" },
      }),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });

  let exited = false;
  child.once("exit", () => {
    exited = true;
  });

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (exited) throw new Error("app process exited before becoming healthy");
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const body = (await res.json()) as { status?: string };
        if (body.status === "ok") break;
      }
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error("app did not become healthy (/health ok) within 30s");
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return {
    url,
    pid: child.pid ?? -1,
    alive: () => !exited,
    async stop() {
      if (exited) return;
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}
