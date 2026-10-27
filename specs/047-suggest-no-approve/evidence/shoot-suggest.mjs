// Live check of Dismiss on a `suggest` proposal, in Brave, light and dark, at 1280 and 390 px.
//
//   STACKS_SHOOT_CREDS=<json> PLAYWRIGHT_CORE=<a file inside a dir whose node_modules holds playwright-core>
//     node specs/047-suggest-no-approve/evidence/shoot-suggest.mjs [--out <dir>]
//
// Creds file (untracked, outside the repo): {"operator":{username,password,userId},"player":{userId},"player2":{userId}}.
// Per run it seeds one session from the `dm-approvals` fixture (seed-suggest.mjs) with the operator seated as DM, then:
//   live     opens /play/:id as the DM, opens the approvals slide-out, asserts the scene row (P3, policy suggest)
//            shows "Suggestion" and Dismiss and no Approve, clicks Dismiss, asserts the row leaves the list and
//            the stored log gains exactly one `proposal.rejected` row for P3 with `reason: null`.
//   fixture  opens /play/fixtures/dm-approvals (viewer DM, last step) and repeats the row assertions;
//            Dismiss removes the row at once.
// Also asserts no <dialog> in the DOM and no horizontal overflow at 390 px.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const out = args.out ?? join(here, "shots");
const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const base = "http://localhost:3100";
const DB_CONTAINER = "stacks-task-0100-db-1";
const SCENE = "Move the party into the vault";
mkdirSync(out, { recursive: true });

const SIZES = [
  [1280, 800],
  [390, 844],
];
const log = [];
const note = (tag, ok, text) => {
  const line = `${ok ? "PASS" : "FAIL"} ${tag}: ${text}`;
  log.push(line);
  console.log(line);
};
const seed = () =>
  execFileSync(
    "node",
    [join(here, "seed-suggest.mjs"), creds.operator.userId, creds.player.userId, creds.player2.userId],
    { encoding: "utf8" },
  ).trim();
const sql = (q) =>
  execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "stacks", "-d", "stacks", "-At", "-c", q], {
    encoding: "utf8",
  }).trim();
const rejectedRows = (sessionId) =>
  sql(
    `select seq || '|' || payload::text from events where session_id='${sessionId}' and type='proposal.rejected' and payload->>'proposalId'='prop-3' order by seq`,
  )
    .split("\n")
    .filter(Boolean);

async function signIn(page, who) {
  await page.goto(`${base}/`);
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.locator('form button[type="submit"]').first().click();
  await page.locator("#username").waitFor({ state: "detached", timeout: 15000 });
}

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  for (const scheme of ["light", "dark"]) {
    for (const [width, height] of SIZES) {
      const tag = `${width}-${scheme}`;
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
      await ctx.addCookies([{ name: "stacks-theme", value: scheme, url: base }]);
      const page = await ctx.newPage();
      await signIn(page, creds.operator);
      const shot = async (name) => {
        const file = join(out, `${name}-${tag}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(file);
      };
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const openPanel = async () => {
        const trigger = page.getByRole("button", { name: /Pending proposals \(/ });
        await trigger.waitFor({ timeout: 15000 });
        if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
        await page.getByText(SCENE).first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(500);
      };
      const row = () => page.locator("li", { hasText: SCENE });
      const assertRow = async (label) => {
        const r = row();
        const text = (await r.innerText()).replace(/\s+/g, " ");
        const buttons = await r.getByRole("button").allInnerTexts();
        note(`${tag} ${label} suggestion-label`, /Suggestion/.test(text), text);
        note(`${tag} ${label} row-buttons`, buttons.join(",") === "Dismiss", `buttons: ${buttons.join(",")}`);
        const others = await page.locator("li").filter({ hasNotText: SCENE }).getByRole("button", { name: "Approve" }).count();
        note(`${tag} ${label} ask-rows-keep-approve`, others === 2, `Approve controls on other rows: ${others}`);
      };
      const clean = async (label) => {
        note(`${tag} ${label} no-dialog`, (await page.locator("dialog").count()) === 0, "no <dialog> in the DOM");
        if (width === 390) {
          const o = await overflow();
          note(`${tag} ${label} no-overflow`, o <= 0, `horizontal overflow ${o} px`);
        }
      };

      // Live route.
      const url = seed();
      const sessionId = url.split("/").pop();
      await page.goto(url);
      await openPanel();
      await assertRow("live");
      await clean("live-before");
      note(`${tag} live rejected-rows-before`, rejectedRows(sessionId).length === 0, `rows: ${rejectedRows(sessionId).length}`);
      await shot("suggest-live-before");
      await row().getByRole("button", { name: "Dismiss" }).click();
      await row().waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      note(`${tag} live row-left`, (await row().count()) === 0, "scene row left the list");
      const rows = rejectedRows(sessionId);
      const payload = rows.length === 1 ? JSON.parse(rows[0].slice(rows[0].indexOf("|") + 1)) : null;
      note(`${tag} live one-rejected-row`, rows.length === 1, `rows: ${rows.length} ${rows.join(" ; ")}`);
      note(`${tag} live reason-null`, payload !== null && payload.reason === null, JSON.stringify(payload));
      await clean("live-after");
      await shot("suggest-live-after");

      // Fixture route (viewer DM, last step).
      await page.goto(`${base}/play/fixtures/dm-approvals`);
      await openPanel();
      await assertRow("fixture");
      await clean("fixture-before");
      await shot("suggest-fixture-before");
      await row().getByRole("button", { name: "Dismiss" }).click();
      await page.waitForTimeout(300);
      note(`${tag} fixture row-left`, (await row().count()) === 0, "scene row left at once");
      await clean("fixture-after");
      await shot("suggest-fixture-after");

      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
const fails = log.filter((l) => l.startsWith("FAIL")).length;
console.log("---\n" + log.join("\n") + `\n--- ${log.length - fails} PASS, ${fails} FAIL`);
