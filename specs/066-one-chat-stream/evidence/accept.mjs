// Sends `action.accept` as the signed-in operator over the WS (spec 066 plan D6, local app only).
//   STACKS_SESSION=<cookie value> APP_PORT=<port> node accept.mjs <sessionId> <suggestionId> <itemId>
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../apps/server/package.json", import.meta.url));
const WebSocket = require("ws");
const [sessionId, suggestionId, itemId = "i1"] = process.argv.slice(2);
const cookie = process.env.STACKS_SESSION;
if (!sessionId || !suggestionId || !cookie) process.exit(2);
const ws = new WebSocket(`ws://localhost:${process.env.APP_PORT ?? "3000"}/ws`, { headers: { cookie: `session=${cookie}` } });
const timer = setTimeout(() => { console.error("timed out"); process.exit(1); }, 10_000);
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", sessionId }));
  ws.send(JSON.stringify({ type: "send", sessionId, eventType: "action.accept", payloadVersion: 1, payload: { suggestionId, itemId } }));
});
ws.on("message", (raw) => {
  const f = JSON.parse(String(raw));
  if (f.type === "error") { console.error(`refused: ${f.code ?? "error"} ${f.message ?? ""}`); process.exit(1); }
  if (f.type === "event" && f.event?.type === "intent.recorded") {
    console.log(`recorded seq ${f.event.seq} outcome ${f.event.payload.outcome}`);
    clearTimeout(timer); ws.close(); process.exit(0);
  }
});
