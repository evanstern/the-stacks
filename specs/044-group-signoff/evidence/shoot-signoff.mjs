// Live check of group sign-off on /play/:id in Brave, light and dark, at 1280 and 390 px.
//
//   STACKS_SHOOT_CREDS=<json> PLAYWRIGHT_CORE=<a file inside a dir whose node_modules holds playwright-core>
//     node specs/044-group-signoff/evidence/shoot-signoff.mjs [--out <dir>]
//
// Creds file (untracked, outside the repo): {"player":{username,password,userId},"player2":{...}}.
// Per run it seeds three sessions from the `group-signoff` fixture (seed-signoff.mjs):
//   S1 through seq 4  Ana declared a party action, Cleo has not answered (waiting)
//   S2 through seq 5  Cleo objected
//   S3 through seq 4  only Ana connected, so Cleo shows Away
// then drives S1 live: Cleo clicks Approve, the quorum completes and the gate commits as group.
// The env fake provider returns empty bodies, so the DM turn that follows fails; sign-off happens before it.
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
const base = "http://localhost:3049";
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
const seed = (through) =>
  execFileSync(
    "node",
    [join(here, "seed-signoff.mjs"), String(through), creds.player.userId, creds.player2.userId],
    { encoding: "utf8" },
  ).trim();

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
      const mk = async (who) => {
        const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
        await ctx.addCookies([{ name: "stacks-theme", value: scheme, url: base }]);
        const page = await ctx.newPage();
        await signIn(page, who);
        return { ctx, page };
      };
      const shot = async (page, name) => {
        const file = join(out, `${name}-${tag}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(file);
      };
      const open = async (page, url) => {
        await page.goto(url);
        await page.getByRole("region", { name: "Sign-off" }).first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(1500);
        await page.getByRole("region", { name: "Sign-off" }).first().scrollIntoViewIfNeeded();
      };
      const overflow = (page) =>
        page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const ana = await mk(creds.player);
      const cleo = await mk(creds.player2);
      const [s1, s2, s3] = [seed(4), seed(5), seed(4)];

      // S2: the objection, seen by Ana (declarer). Both connected.
      await open(ana.page, s2);
      await open(cleo.page, s2);
      await ana.page.waitForTimeout(1000);
      const rows2 = (await ana.page.getByRole("region", { name: "Sign-off" }).first().innerText()).replace(/\s+/g, " ");
      note(`${tag} objection`, /Cleo\s*Objects/.test(rows2), rows2);
      note(`${tag} no-dialog`, (await ana.page.locator("dialog").count()) === 0, "no <dialog> in the DOM");
      note(`${tag} no-overflow`, (await overflow(ana.page)) <= 0, `horizontal overflow ${await overflow(ana.page)} px`);
      await shot(ana.page, "signoff-objection");

      // S1: waiting on Cleo, seen by Cleo. Cleo's own row carries Approve and Object.
      await open(ana.page, s1);
      await open(cleo.page, s1);
      const region = cleo.page.getByRole("region", { name: "Sign-off" }).first();
      const rows1 = (await region.innerText()).replace(/\s+/g, " ");
      note(`${tag} waiting`, /Waiting/.test(rows1) && /Approved/.test(rows1), rows1);
      const ownButtons = await region.getByRole("button").allInnerTexts();
      note(`${tag} own-row-buttons`, ownButtons.join(",") === "Approve,Object", ownButtons.join(","));
      await shot(cleo.page, "signoff-waiting");

      // S1 live: Cleo approves; the gate commits as group.
      await region.getByRole("button", { name: "Approve" }).click();
      const committed = cleo.page.getByText(/Committed by/).first();
      await committed.waitFor({ timeout: 15000 }).catch(() => {});
      note(`${tag} committed`, (await committed.count()) > 0, (await committed.count()) > 0 ? await committed.innerText() : "no Committed line");
      await cleo.page.waitForTimeout(1000);
      await committed.scrollIntoViewIfNeeded().catch(() => {});
      await shot(cleo.page, "signoff-committed");

      // S3: only Ana is connected, so Cleo is away.
      await ana.page.goto(s3);
      await ana.page.getByRole("region", { name: "Sign-off" }).first().waitFor({ timeout: 15000 });
      await ana.page.waitForTimeout(1500);
      const rows3 = (await ana.page.getByRole("region", { name: "Sign-off" }).first().innerText()).replace(/\s+/g, " ");
      note(`${tag} away`, /Cleo\s*Away/.test(rows3), rows3);
      await shot(ana.page, "signoff-away");

      await ana.ctx.close();
      await cleo.ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log("---\n" + log.join("\n"));
