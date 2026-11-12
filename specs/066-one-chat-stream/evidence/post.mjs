// Posts one Intent as a named player over the WebSocket `send` frame (spec 066 plan D6).
//
//   STACKS_SESSION=<session cookie value> node specs/066-one-chat-stream/evidence/post.mjs \
//     <sessionId> <actorCharacterId> <kind> "<text>" [commit=declared] [intentId]
//
// Reads the cookie from the environment only; never prints it. Connects to ws://localhost:$APP_PORT
// (default 3000) and exits when its own `intent.recorded` row (or an error frame) arrives.
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../apps/server/package.json", import.meta.url));
const WebSocket = require("ws");

const [sessionId, actor, kind, text, commit = "declared", id] = process.argv.slice(2);
const cookie = process.env.STACKS_SESSION;
if (!sessionId || !actor || !kind || !text || !cookie) {
  console.error('usage: STACKS_SESSION=<cookie> post.mjs <sessionId> <actor> <kind> "<text>" [commit] [intentId]');
  process.exit(2);
}
const port = process.env.APP_PORT ?? "3000";
const intentId = id ?? `post-${Date.now().toString(36)}`;
const ws = new WebSocket(`ws://localhost:${port}/ws`, { headers: { cookie: `session=${cookie}` } });
const timer = setTimeout(() => {
  console.error("timed out waiting for the carrier row");
  process.exit(1);
}, 10_000);
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", sessionId }));
  ws.send(
    JSON.stringify({
      type: "send",
      sessionId,
      eventType: "intent",
      payloadVersion: 1,
      payload: {
        intent: { id: intentId, kind, actor: { kind: "pc", id: actor }, text, source: "composer", commit },
      },
    }),
  );
});
ws.on("message", (raw) => {
  const f = JSON.parse(String(raw));
  if (f.type === "error") {
    console.error(`refused: ${f.code ?? "error"} ${f.message ?? ""}`);
    process.exit(1);
  }
  if (f.type === "event" && f.event?.type === "intent.recorded" && f.event.payload?.intent?.id === intentId) {
    console.log(`recorded seq ${f.event.seq} outcome ${f.event.payload.outcome}`);
    clearTimeout(timer);
    ws.close();
    process.exit(0);
  }
});
