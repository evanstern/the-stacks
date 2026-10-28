// Step 9 baseline (spec 055): the human DM dismisses the scene-start suggestion instead of carrying it out.
//
//   STACKS_SHOOT_CREDS=<creds json> PLAYWRIGHT_CORE=<path in a dir whose node_modules holds playwright-core>
//     node specs/055-human-dm-scene-change/evidence/baseline-dismiss.mjs
//
// Runs start-human-dm.mjs for a fresh session, opens the table in Brave as the operator, opens
// "Pending proposals", clicks Dismiss on the scene suggestion, and prints the session id. It commits
// no action. It never prints a password.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const credsPath = process.env.STACKS_SHOOT_CREDS;
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, "../../../.env"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = `http://localhost:${env.APP_PORT ?? "3000"}`;
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const started = execFileSync("node", [join(here, "start-human-dm.mjs"), credsPath], { encoding: "utf8" });
const sessionId = started.match(/sessionId (\S+)/)[1];
console.log(`session ${sessionId}`);
const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: false, timeout: 30000 });
try {
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await a.goto(`${base}/`);
  await a.fill("#username", creds.operator.username);
  await a.fill("#password", creds.operator.password);
  await a.locator('form button[type="submit"]').first().click();
  await a.locator("#username").waitFor({ state: "detached", timeout: 15000 });
  await a.goto(`${base}/play/${sessionId}`);
  await a.getByText("No scene yet").first().waitFor({ timeout: 20000 });
  await a.getByRole("button", { name: /Pending proposals/ }).click();
  const card = a.locator("section, article, li, div").filter({ hasText: "scene · from DM" }).filter({ has: a.getByRole("button", { name: "Dismiss" }) }).last();
  await card.waitFor({ timeout: 15000 });
  await card.getByRole("button", { name: "Dismiss" }).first().click();
  await a.waitForTimeout(6000);
  console.log(`no modal: ${(await a.locator("dialog[open],[aria-modal=true]").count()) === 0}`);
  console.log(`header still shows no scene: ${await a.getByText("No scene yet").first().isVisible()}`);
} finally {
  await browser.close();
}
