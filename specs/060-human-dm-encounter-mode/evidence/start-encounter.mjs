// Starts an encounter as the seated human DM (spec 060 quickstart step 6).
//
//   node specs/060-human-dm-encounter-mode/evidence/start-encounter.mjs <creds-file> <session-id>
//
// <creds-file> is a JSON file OUTSIDE the repo:
//   {"operator": {"username","password"}, "player": {"username","password","userId"}}
// The script signs in as the operator (the seated DM), reads Tamsin's combatant id from her
// `party.member.changed` row (GET /dm/sessions/<id>/events), then over /ws sends `mechanics`
// `initiative.roll` with Tamsin as the only participant and `table-mode` turn with the player as
// the active actor. It prints each resulting event type, or the refusal. It never prints a secret.
// The app port comes from APP_PORT in the worktree .env. Node 22 built-ins only.
import { readFileSync } from "node:fs";

const [credsPath, sessionId] = process.argv.slice(2);
if (!credsPath || !sessionId) {
  console.error("usage: start-encounter.mjs <creds-file> <session-id>");
  process.exit(2);
}
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const env = Object.fromEntries(
  readFileSync(new URL("../../../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const host = `localhost:${env.APP_PORT ?? "3000"}`;
const base = `http://${host}`;

const signIn = await fetch(`${base}/auth/sign-in`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: creds.operator.username, password: creds.operator.password }),
});
if (!signIn.ok) {
  console.error(`sign-in refused: HTTP ${signIn.status}`);
  process.exit(1);
}
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

// Read the whole log: Tamsin's combatant id and the head seq.
const rows = [];
let after = 0;
let headSeq = 0;
for (;;) {
  const page = await (
    await fetch(`${base}/dm/sessions/${sessionId}/events?after=${after}&limit=200`, { headers: { cookie } })
  ).json();
  rows.push(...page.events);
  headSeq = page.headSeq;
  after = page.nextAfter;
  if (!page.hasMore) break;
}
const party = rows.filter(
  (r) => r.type === "party.member.changed" && r.payload?.after?.characterId === "tamsin",
);
const combatantId = party.at(-1)?.payload?.after?.combatantId;
if (!combatantId) {
  console.error("no combatant id on Tamsin's party.member.changed row: approve the scene-start suggestions first");
  process.exit(1);
}
console.log(`tamsin combatant ${combatantId}`);

const requests = [
  {
    eventType: "mechanics",
    payload: {
      command: {
        type: "initiative.roll",
        participants: [{ combatantId, mode: "normal" }],
        reason: "The DM starts the fight at the ford",
      },
      actionId: null,
      visibility: "public",
      summary: "Roll initiative",
      rationale: null,
    },
  },
  {
    eventType: "table-mode",
    payload: {
      reason: "Turn order begins",
      after: { mode: "turn", activeActor: creds.player.userId, activeCharacterId: "tamsin" },
      summary: "Table mode: turn",
      rationale: null,
    },
  },
];

// One request at a time: a send is confirmed only by the event frames it produces (no acks).
const ws = new WebSocket(`ws://${host}/ws`, { headers: { cookie } });
const frames = [];
let wake = () => {};
ws.addEventListener("message", (msg) => {
  frames.push(JSON.parse(String(msg.data)));
  wake();
});
const next = (ms) =>
  new Promise((resolve) => {
    if (frames.length) return resolve(frames.shift());
    const t = setTimeout(() => resolve(null), ms);
    wake = () => {
      clearTimeout(t);
      resolve(frames.shift());
    };
  });
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", () => reject(new Error("websocket error")));
});
ws.send(JSON.stringify({ type: "subscribe", sessionId, afterSeq: headSeq }));
for (let f = await next(10_000); f && f.type !== "replay-complete"; f = await next(10_000)) {}

let failed = false;
for (const r of requests) {
  ws.send(JSON.stringify({ type: "send", sessionId, ...r, payloadVersion: 1 }));
  const seen = [];
  // Collect the frames this request produces until the stream goes quiet for 1.5 s.
  for (let f = await next(10_000); f; f = await next(1500)) {
    if (f.type === "error") {
      seen.push(`error ${f.code ?? f.kind}: ${f.message}`);
      failed = true;
      break;
    }
    if (f.type === "event") seen.push(f.event?.type);
  }
  console.log(`${r.eventType}: ${seen.length ? seen.join(", ") : "no frame"}`);
  if (failed || seen.length === 0) break;
}
ws.close();
process.exit(failed ? 1 : 0);
