// Posts Odo's run 2 line as public IC talk, for the script-mode live check (plan D8).
//
//   STACKS_COOKIE='<session cookie>' node specs/065-talk-triggers/evidence/talk.mjs <appPort> <sessionId> [characterId]
//
// Run it against the worktree stack with DM_FAKE_SCRIPT=greyhollow-talk. The cookie is the
// player's session cookie from the browser. Never commit it. Uses `ws` from apps/server.
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../apps/server/package.json", import.meta.url));
const WebSocket = require("ws");

const [port, sessionId, characterId = "tamsin"] = process.argv.slice(2);
const cookie = process.env.STACKS_COOKIE;
if (!port || !sessionId || !cookie) {
  console.error("usage: STACKS_COOKIE=... talk.mjs <appPort> <sessionId> [characterId]");
  process.exit(2);
}
const text = "Wenna, who's missing from this house?";
const ws = new WebSocket(`ws://localhost:${port}/ws`, { headers: { cookie } });
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", sessionId }));
  ws.send(
    JSON.stringify({
      type: "send",
      sessionId,
      eventType: "talk",
      payloadVersion: 1,
      visibility: "public",
      payload: { talk: { text, channel: "ic", characterId } },
    }),
  );
});
let posted = false; // the subscribe replay brings older narration first; wait for our own post
ws.on("message", (m) => {
  const f = JSON.parse(String(m));
  if (f.type === "event" && f.event.type === "talk") posted = true;
  if (f.type === "error") console.log("error", f.code ?? f.kind, f.message);
  if (f.type === "event" && posted && f.event.type === "narration" && f.event.actor === "ai:dm") {
    console.log("DM narration:", f.event.payload.text);
    ws.close();
    process.exit(0);
  }
});
setTimeout(() => process.exit(1), 60_000);
