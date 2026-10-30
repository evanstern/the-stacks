// Declares and commits `act-197dae73` for Tamsin over the WebSocket (spec 064 live check).
//
//   node specs/064-plan-first-step/evidence/declare.mjs <creds-file> <sessionId>
//
// <creds-file> is a JSON file OUTSIDE the repo: {"username": "...", "password": "..."}.
// The script signs in, opens /ws with the session cookie, subscribes, and sends the gate
// requests `action.declare` then `action.commit` (docs/wiki/ws-protocol.md `send` frames;
// payload shapes as apps/web/app/play/frames.ts builds them). The action id is fixed to
// `act-197dae73`, which greyhollow-plan-approach's interpret call names. It prints each
// refusal code and exits nonzero on one. It never prints a secret.
// Node 22 built-ins only: the global WebSocket (undici) accepts a `headers` option.
import { readFileSync } from "node:fs";

const [credsPath, sessionId] = process.argv.slice(2);
if (!credsPath || !sessionId) {
  console.error("usage: declare.mjs <creds-file> <sessionId>");
  process.exit(2);
}
const { username, password } = JSON.parse(readFileSync(credsPath, "utf8"));
const env = Object.fromEntries(
  readFileSync(new URL("../../../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const host = `localhost:${env.APP_PORT ?? "3000"}`;

const signIn = await fetch(`http://${host}/auth/sign-in`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
if (!signIn.ok) {
  console.error(`sign-in refused: HTTP ${signIn.status}`);
  process.exit(1);
}
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

const ACTION_ID = "act-197dae73";
const send = (eventType, payload) =>
  JSON.stringify({
    type: "send",
    sessionId,
    eventType,
    payload,
    payloadVersion: 1,
  });

const ws = new WebSocket(`ws://${host}/ws`, { headers: { cookie } });
let failed = false;
let sawDeclared = false;
let sawCommitted = false;
const timer = setTimeout(() => {
  console.error("timed out waiting for the declare and commit events");
  process.exit(1);
}, 30_000);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", sessionId, afterSeq: 0 }));
});
ws.addEventListener("message", (msg) => {
  const frame = JSON.parse(String(msg.data));
  if (frame.type === "replay-complete") {
    ws.send(
      send("action.declare", {
        action: {
          actionId: ACTION_ID,
          characterId: "tamsin",
          scope: "character",
          text: "Plan: diplomacy first, then force. Approach: I walk openly to the goblin camp while Kestrel and Odo follow hidden through the reeds. Contingency: if I raise my hand, Kestrel attacks on my signal.",
        },
      }),
    );
  } else if (frame.type === "error") {
    failed = true;
    console.error(`refused: ${frame.code ?? frame.kind}: ${frame.message}`);
    clearTimeout(timer);
    ws.close();
  } else if (frame.type === "event") {
    const t = frame.event?.type;
    if (t === "action.declared" && !sawDeclared) {
      sawDeclared = true;
      console.log("declared act-197dae73");
      ws.send(send("action.commit", { actionId: ACTION_ID }));
    } else if (t === "action.committed" && !sawCommitted) {
      sawCommitted = true;
      console.log("committed act-197dae73");
      clearTimeout(timer);
      ws.close();
    }
  }
});
ws.addEventListener("close", () => process.exit(failed ? 1 : 0));
ws.addEventListener("error", () => {
  console.error("websocket error");
  process.exit(1);
});
