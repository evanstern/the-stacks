#!/usr/bin/env node
// Local stack only. Seeds a table with test accounts and drives it. Credentials live in a JSON
// file OUTSIDE the repo; this script never prints a password.
//   node local-table.mjs seed  <creds-file> <port> [seedId=greyhollow-ford] [characters=tamsin]
//        characters is a comma list: the 1st seat goes to the operator, the 2nd to player2 (two-human seeds)
//        needs creds.operator = {username,password} (made by create-operator, see SKILL.md);
//        adds creds.player by invitation, starts a scene seating the operator, prints the session id
//   node local-table.mjs talk  <creds-file> <port> <sessionId> "<text>" [character=tamsin]
//        posts one public in-character line as the operator (needs `ws`, resolved from apps/server)
//   node local-table.mjs act   <creds-file> <port> <sessionId> "<text>" <character> <actionId> [account=operator|player]
//        declares and commits one action for a character, then waits for action.committed
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const [cmd, credsPath, port, ...rest] = process.argv.slice(2);
if (!cmd || !credsPath || !port) { console.error("usage: local-table.mjs seed|talk|act <creds-file> <port> ..."); process.exit(64); }
const base = `http://localhost:${port}`;
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const J = { "content-type": "application/json" };
async function signIn({ username, password }) {
  const r = await fetch(`${base}/auth/sign-in`, { method: "POST", headers: J, body: JSON.stringify({ username, password }) });
  if (!r.ok) { console.error(`sign-in refused: HTTP ${r.status}`); process.exit(1); }
  return { cookie: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), user: (await r.json()).user };
}

if (cmd === "seed") {
  const [seedId = "greyhollow-ford", characters = "tamsin"] = rest;
  const op = await signIn(creds.operator);
  if (!creds.player) {
    const inv = await (await fetch(`${base}/auth/invitations`, { method: "POST", headers: { ...J, cookie: op.cookie }, body: "{}" })).json();
    const player = { username: "player2", password: randomBytes(18).toString("base64url") };
    const red = await fetch(`${base}/auth/invitations/redeem`, {
      method: "POST", headers: J, body: JSON.stringify({ token: inv.token, displayName: "Player Two", ...player }),
    });
    if (red.status !== 201) { console.error(`redeem refused: HTTP ${red.status}`); process.exit(1); }
    creds.player = player;
    writeFileSync(credsPath, JSON.stringify(creds, null, 2));
    console.log("player account created (credentials in the creds file)");
  }
  const sessionId = randomUUID();
  const [first, second] = characters.split(",");
  const seats = { [first]: op.user.id };
  if (second) seats[second] = (await signIn(creds.player)).user.id;
  const r = await fetch(`${base}/dm/sessions/${sessionId}/start`, {
    method: "POST", headers: { ...J, cookie: op.cookie }, body: JSON.stringify({ seedId, seats }),
  });
  if (r.status !== 202) { console.error(`start refused: HTTP ${r.status} ${await r.text()}`); process.exit(1); }
  console.log(`sessionId ${sessionId}\nplay  ${base}/play/${sessionId}\ndebug ${base}/play/${sessionId}/debug`);
} else if (cmd === "talk") {
  const [sessionId, text, character = "tamsin"] = rest;
  const WebSocket = createRequire(new URL("../../../../apps/server/package.json", import.meta.url))("ws");
  const { cookie } = await signIn(creds.operator);
  const ws = new WebSocket(`ws://localhost:${port}/ws`, { headers: { cookie } });
  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "subscribe", sessionId }));
    ws.send(JSON.stringify({ type: "send", sessionId, eventType: "talk", payloadVersion: 1, visibility: "public",
      payload: { talk: { text, channel: "ic", characterId: character } } }));
  });
  ws.on("message", (m) => {
    const f = JSON.parse(String(m));
    if (f.type === "error") { console.error(`refused: ${f.code ?? f.kind}: ${f.message}`); process.exit(1); }
    if (f.type === "event" && f.event.type === "talk" && f.event.payload?.text === text) { console.log("talk posted"); ws.close(); process.exit(0); }
  });
  setTimeout(() => { console.error("timed out"); process.exit(1); }, 30_000);
} else if (cmd === "act") {
  const [sessionId, text, character, actionId, account = "operator"] = rest;
  const WebSocket = createRequire(new URL("../../../../apps/server/package.json", import.meta.url))("ws");
  const { cookie } = await signIn(creds[account]);
  const ws = new WebSocket(`ws://localhost:${port}/ws`, { headers: { cookie } });
  const send = (eventType, payload) => ws.send(JSON.stringify({ type: "send", sessionId, eventType, payload, payloadVersion: 1 }));
  ws.on("open", () => ws.send(JSON.stringify({ type: "subscribe", sessionId, afterSeq: 0 })));
  ws.on("message", (m) => {
    const f = JSON.parse(String(m));
    if (f.type === "replay-complete") send("action.declare", { action: { actionId, characterId: character, scope: "character", text } });
    else if (f.type === "error") { console.error(`refused: ${f.code ?? f.kind}: ${f.message}`); process.exit(1); }
    else if (f.type === "event" && f.event.type === "action.declared" && f.event.payload?.actionId === actionId) send("action.commit", { actionId });
    else if (f.type === "event" && f.event.type === "action.committed" && f.event.payload?.actionId === actionId) { console.log(`committed ${actionId}`); ws.close(); process.exit(0); }
  });
  setTimeout(() => { console.error("timed out"); process.exit(1); }, 30_000);
} else { console.error("unknown command"); process.exit(64); }
