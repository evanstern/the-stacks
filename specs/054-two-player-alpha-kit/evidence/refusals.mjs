// Checks the three server refusals of quickstart.md. Needs the shoot-live.mjs run first (it makes the
// accounts and a started session). Usage: node refusals.mjs <creds-file> <started-session-id>
// Prints status codes and error messages only. Never prints a password.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const [credsPath, startedId] = process.argv.slice(2);
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const env = Object.fromEntries(readFileSync(new URL("../../../.env", import.meta.url), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = `http://localhost:${env.APP_PORT ?? "3000"}`;
async function login(c) {
  const r = await fetch(`${base}/auth/sign-in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: c.username, password: c.password }) });
  const { user } = await r.json();
  return { id: user.id, cookie: r.headers.getSetCookie().map((x) => x.split(";")[0]).join("; ") };
}
const op = await login(creds.operator);
const pl = await login(creds.player);
const post = (s, id, seats, seedId = "greyhollow-ford-duo") => fetch(`${base}/dm/sessions/${id}/start`, { method: "POST", headers: { "content-type": "application/json", cookie: s.cookie }, body: JSON.stringify({ seedId, seats }) });
const show = async (label, r) => console.log(`${label}: ${r.status} ${(await r.text()).slice(0, 300)}`);
await show("GET /dm/seeds as player", await fetch(`${base}/dm/seeds`, { headers: { cookie: pl.cookie } }));
await show("duplicate seat (one user on both seats), fresh session", await post(op, randomUUID(), { tamsin: op.id, kestrel: op.id }));
await show("second start on the started session", await post(op, startedId, { tamsin: op.id, kestrel: pl.id }));
