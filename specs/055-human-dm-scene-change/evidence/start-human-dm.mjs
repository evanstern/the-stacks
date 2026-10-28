// Starts a scripted scene with a human DM seated (spec 055 quickstart step 4).
//
//   node specs/055-human-dm-scene-change/evidence/start-human-dm.mjs <creds-file>
//
// <creds-file> is a JSON file OUTSIDE the repo:
//   {"operator": {"username","password"}, "player": {"username","password","userId"}}
// The script signs in as the operator, opens /ws on a fresh session id, sends the `dm.seat`
// gate request (after: { kind: "human", userId: <operator id> }), calls
// POST /dm/sessions/<id>/start for `greyhollow-ford` with the player on the human seat
// (tamsin), and prints the session id, the play URL and the debug URL. It never prints a secret.
// The app port comes from APP_PORT in the worktree .env. Node 22 built-ins only.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const [credsPath] = process.argv.slice(2);
if (!credsPath) {
  console.error("usage: start-human-dm.mjs <creds-file>");
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
  body: JSON.stringify({
    username: creds.operator.username,
    password: creds.operator.password,
  }),
});
if (!signIn.ok) {
  console.error(`sign-in refused: HTTP ${signIn.status}`);
  process.exit(1);
}
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const me = await (await fetch(`${base}/auth/me`, { headers: { cookie } })).json();
const operatorId = me.userId ?? me.user?.id ?? me.id;
if (!operatorId || !creds.player?.userId) {
  console.error("missing operator or player user id");
  process.exit(1);
}

const sessionId = randomUUID();

// Seat the operator as the human DM before the scene starts.
await new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://${host}/ws`, { headers: { cookie } });
  const timer = setTimeout(() => reject(new Error("dm.seat timed out")), 30_000);
  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "subscribe", sessionId, afterSeq: 0 }));
  });
  ws.addEventListener("message", (msg) => {
    const frame = JSON.parse(String(msg.data));
    if (frame.type === "replay-complete") {
      ws.send(
        JSON.stringify({
          type: "send",
          sessionId,
          eventType: "dm.seat",
          payload: {
            reason: "A human takes the DM seat before the scene starts",
            after: { kind: "human", userId: operatorId },
          },
          payloadVersion: 1,
        }),
      );
    } else if (frame.type === "error") {
      clearTimeout(timer);
      ws.close();
      reject(new Error(`dm.seat refused: ${frame.code ?? frame.kind}: ${frame.message}`));
    } else if (frame.type === "event" && frame.event?.type === "dm.seat.changed") {
      clearTimeout(timer);
      ws.close();
      resolve();
    }
  });
  ws.addEventListener("error", () => reject(new Error("websocket error")));
}).catch((e) => {
  console.error(e.message);
  process.exit(1);
});

const start = await fetch(`${base}/dm/sessions/${sessionId}/start`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    seedId: "greyhollow-ford",
    seats: { tamsin: creds.player.userId },
  }),
});
if (start.status !== 202) {
  console.error(`start refused: HTTP ${start.status} ${await start.text()}`);
  process.exit(1);
}
console.log(`sessionId ${sessionId}`);
console.log(`play      ${base}/play/${sessionId}`);
console.log(`debug     ${base}/play/${sessionId}/debug`);
