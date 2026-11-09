import { createInterface } from "node:readline/promises";
import { createOperator, hasOperator } from "../auth/provisioning.js";
import { loadConfig } from "../config.js";
import { createDb } from "../db.js";

// This file compiles into dist/cli/create-operator.js under tsc -b, so the
// runtime image (which ships dist, not src) carries it. See
// apps/server/package.json's db:migrate script and its comment for the
// host-only, strip-types sibling (scripts/migrate.ts) — that one stays
// under scripts/ because it must run without a build step.

// TEST_DATABASE_URL first, DATABASE_URL second — same precedence as
// scripts/migrate.ts, and for the same reason: this runs on the HOST, and
// DATABASE_URL names the address the app CONTAINER uses.
const config = loadConfig();
const databaseUrl = process.env.TEST_DATABASE_URL || config.databaseUrl;
const target = new URL(databaseUrl);
// Host and database only — never the user or password.
console.log(
  `target: ${target.hostname}:${target.port || 5432}${target.pathname} (from ${
    process.env.TEST_DATABASE_URL ? "TEST_DATABASE_URL" : "DATABASE_URL"
  })`,
);
const db = createDb(databaseUrl);

/** OPERATOR_PASSWORD env var, or an interactive prompt (research D6). */
async function readPassword(): Promise<string> {
  if (process.env.OPERATOR_PASSWORD) {
    return process.env.OPERATOR_PASSWORD;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question("Operator password: ");
  } finally {
    rl.close();
  }
}

try {
  const username = process.env.OPERATOR_USERNAME || "operator";

  // Refuses to clobber (research D6, US3 scenario 2): a second run must
  // not create a second operator or overwrite the first.
  //
  // CHECK BEFORE PROMPTING, deliberately. Prompting first makes an operator
  // type a secret that is then thrown away, and — worse — a non-interactive
  // run (CI, a provisioning script, `docker compose run`) HANGS on a prompt
  // for input that never arrives, instead of failing fast with a clear
  // message. Refuse before asking for anything.
  if (await hasOperator(db)) {
    console.error(
      "An operator account already exists. Refusing to create a second one " +
        "or overwrite the first (research D6, US3 scenario 2) — no changes made.",
    );
    process.exitCode = 1;
  } else {
    const password = await readPassword();
    if (!password) {
      throw new Error(
        "a non-empty password is required (set OPERATOR_PASSWORD or enter one)",
      );
    }
    const result = await createOperator(db, { username, password });
    if (!result.created) {
      console.error(
        "An operator account already exists. Refusing to create a second one " +
          "or overwrite the first (research D6, US3 scenario 2) — no changes made.",
      );
      process.exitCode = 1;
    } else {
      console.log(`Operator account created: ${result.user.username}`);
    }
  }
} catch (err) {
  console.error(
    "Provisioning failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
