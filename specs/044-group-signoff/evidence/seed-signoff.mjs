// Copies the `group-signoff` fixture (rows with seq <= <through>) into a fresh session on the worktree stack's database.
//
//   node specs/044-group-signoff/evidence/seed-signoff.mjs <through> <anaUserId> <cleoUserId>
//
// Maps fixtureIds.playerUserId to <anaUserId> and fixtureIds.otherPlayerUserId to <cleoUserId>
// in every actor, visibility and payload string. Prints the session URL. Run it only against the
// worktree stack: it reads DATABASE_URL and DB_PORT from the worktree's .env. It imports the built
// server (`pnpm build` first) because the source's `.js`-suffixed imports do not resolve under
// --experimental-strip-types. Adapted from specs/041-debug-page/evidence/seed-live.mjs.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  fixtureIds,
  fixtures,
} from "../../../packages/session-model/dist/fixtures/index.js";

const [through, anaId, cleoId] = process.argv.slice(2);
if (!through || !anaId || !cleoId) {
  console.error("usage: seed-signoff.mjs <through> <anaUserId> <cleoUserId>");
  process.exit(2);
}
const fixture = fixtures.find((f) => f.name === "group-signoff");
const env = Object.fromEntries(
  readFileSync(new URL("../../../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const databaseUrl = env.DATABASE_URL.replace("@db:5432", `@localhost:${env.DB_PORT}`);
const appPort = env.APP_PORT ?? "3000";
const { createDb } = await import("../../../apps/server/dist/db.js");
const { appendBatch } = await import("../../../apps/server/dist/events/log.js");

const map = new Map([
  [fixtureIds.playerUserId, anaId],
  [fixtureIds.otherPlayerUserId, cleoId],
]);
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
    fixture.events
      .filter((e) => e.seq <= Number(through))
      .map((e) => ({
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
