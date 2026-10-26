// Copies one fixture's rows into a fresh session on the worktree stack's database.
//
//   node specs/030-play-route/evidence/seed-live.mjs <fixture-name> <playerUserId> [operatorUserId]
//
// Maps fixtureIds.playerUserId to <playerUserId> (and, when given, fixtureIds.dmActor to
// <operatorUserId>) in every actor, visibility and payload string. Prints the session URL.
// Run it only against the worktree stack: it reads DATABASE_URL and DB_PORT from the
// worktree's .env (the app database, not the throwaway test database). It imports the built server (`pnpm build` first), because the source's
// `.js`-suffixed imports do not resolve under --experimental-strip-types.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  fixtureIds,
  fixtures,
} from "../../../packages/session-model/dist/fixtures/index.js";

const [fixtureName, playerUserId, operatorUserId] = process.argv.slice(2);
if (!fixtureName || !playerUserId) {
  console.error("usage: seed-live.mjs <fixture-name> <playerUserId> [operatorUserId]");
  process.exit(2);
}
const fixture = fixtures.find((f) => f.name === fixtureName);
if (!fixture) {
  console.error(`no fixture "${fixtureName}"; have: ${fixtures.map((f) => f.name).join(", ")}`);
  process.exit(2);
}

const env = Object.fromEntries(
  readFileSync(new URL("../../../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
// The app database, as the host reaches it: DATABASE_URL names the compose service `db`.
const databaseUrl = env.DATABASE_URL.replace("@db:5432", `@localhost:${env.DB_PORT}`);
const appPort = env.APP_PORT ?? "3000";

const { createDb } = await import("../../../apps/server/dist/db.js");
const { appendBatch } = await import("../../../apps/server/dist/events/log.js");

const map = new Map([[fixtureIds.playerUserId, playerUserId]]);
if (operatorUserId) map.set(fixtureIds.dmActor, operatorUserId);
const swap = (v) => {
  if (typeof v === "string") return map.get(v) ?? v;
  if (Array.isArray(v)) return v.map(swap);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
  }
  return v;
};

const sessionId = randomUUID();
const db = createDb(databaseUrl);
try {
  await appendBatch(
    db,
    fixture.events.map((e) => ({
      sessionId,
      actor: swap(e.actor),
      type: e.type,
      payload: swap(e.payload),
      payloadVersion: e.payloadVersion,
      visibility: swap(e.visibility),
    })),
  );
  console.log(`http://localhost:${appPort}/play/${sessionId}`);
} finally {
  await db.$client.end();
}
