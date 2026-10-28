// Starts a scripted scene on the worktree stack (spec 053 quickstart step 7).
//
//   node specs/053-env-fake-dm-script/evidence/start-scene.mjs <creds-file>
//
// <creds-file> is a JSON file OUTSIDE the repo: {"username": "...", "password": "..."}.
// The script signs in through POST /auth/sign-in, mints a session id, seats the operator on
// the human character of `greyhollow-ford` (tamsin), calls POST /dm/sessions/<id>/start, and
// prints the session id, the play URL and the debug URL. It never prints a secret.
//
// The start route enqueues a scene-start job on a fresh session id, so the play page loads
// without a prior seeded event (unlike specs/041-debug-page/evidence/seed-live.mjs).
// The app port comes from APP_PORT in the worktree .env. Node 22 built-ins only.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const [credsPath] = process.argv.slice(2);
if (!credsPath) {
  console.error("usage: start-scene.mjs <creds-file>");
  process.exit(2);
}
const { username, password } = JSON.parse(readFileSync(credsPath, "utf8"));
const env = Object.fromEntries(
  readFileSync(new URL("../../../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = `http://localhost:${env.APP_PORT ?? "3000"}`;

const signIn = await fetch(`${base}/auth/sign-in`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
if (!signIn.ok) {
  console.error(`sign-in refused: HTTP ${signIn.status}`);
  process.exit(1);
}
const { user } = await signIn.json();
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

const sessionId = randomUUID();
const start = await fetch(`${base}/dm/sessions/${sessionId}/start`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    seedId: "greyhollow-ford",
    seats: { tamsin: user.id },
  }),
});
if (start.status !== 202) {
  console.error(`start refused: HTTP ${start.status} ${await start.text()}`);
  process.exit(1);
}
console.log(`sessionId ${sessionId}`);
console.log(`play      ${base}/play/${sessionId}`);
console.log(`debug     ${base}/play/${sessionId}/debug`);
