import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/auth/password.ts";
import { loadConfig } from "../src/config.ts";
import { createDb } from "../src/db.ts";
import { users } from "../src/schema/auth.ts";

// Run with an explicit .ts extension throughout (see package.json's
// db:migrate script and its comment): native TypeScript stripping, not
// tsc, so the .js-suffixed imports src/ uses for its own bundler-resolved
// build don't resolve here. That's also why this script inlines
// createOperator's logic (apps/server/src/auth/provisioning.ts, used by
// the test suite instead) rather than importing it: provisioning.ts
// imports schema/auth.js the way every other src/ file does, and that
// import fails under raw execution one level deeper than migrate.ts's
// comment already warns about.

// TEST_DATABASE_URL first, DATABASE_URL second — same precedence as
// scripts/migrate.ts, and for the same reason: this runs on the HOST, and
// DATABASE_URL names the address the app CONTAINER uses.
const config = loadConfig();
const databaseUrl = process.env.TEST_DATABASE_URL || config.databaseUrl;
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
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "operator"))
    .limit(1);

  if (existing) {
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
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        username,
        displayName: username,
        role: "operator",
        passwordHash,
      })
      .returning();
    console.log(`Operator account created: ${user.username}`);
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
