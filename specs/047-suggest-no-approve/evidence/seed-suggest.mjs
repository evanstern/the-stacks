// Copies the whole `dm-approvals` fixture into a fresh session on the worktree stack's database,
// seating a real operator as the human DM.
//
//   node specs/047-suggest-no-approve/evidence/seed-suggest.mjs <dmUserId> <anaUserId> <cleoUserId>
//
// Maps fixtureIds.dmUserId to <dmUserId>, playerUserId to <anaUserId> and otherPlayerUserId to <cleoUserId>
// in every actor, visibility and payload string. P3 (policy suggest) stays pending in the seeded log.
// Prints the session URL. Run it only against the worktree stack: it reads DATABASE_URL and DB_PORT
// from the worktree's .env. It imports the built server (`pnpm build` first) because the source's
// `.js`-suffixed imports do not resolve under --experimental-strip-types. Adapted from
// specs/044-group-signoff/evidence/seed-signoff.mjs.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  fixtureIds,
  fixtures,
} from "../../../packages/session-model/dist/fixtures/index.js";

const [dmId, anaId, cleoId] = process.argv.slice(2);
if (!dmId || !anaId || !cleoId) {
  console.error("usage: seed-suggest.mjs <dmUserId> <anaUserId> <cleoUserId>");
  process.exit(2);
}
const fixture = fixtures.find((f) => f.name === "dm-approvals");
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
  [fixtureIds.dmUserId, dmId],
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
