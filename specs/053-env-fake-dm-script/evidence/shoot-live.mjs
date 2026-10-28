// Brave screenshots of the live scripted run (spec 053 Phase 4, plan D7).
//
//   STACKS_SHOOT_CREDS=<creds json> PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core>
//     node specs/053-env-fake-dm-script/evidence/shoot-live.mjs <play-url> play-opening|play-after|debug
//
// Creds file (untracked, outside the repo): {"username","password"} of the test operator on this stack.
// Writes shots/<name>-<width>-<scheme>.png at 1280 and 390 px, light and dark. Prints one PASS/FAIL line
// per check (no modal, no horizontal overflow).
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [liveUrl, mode] = process.argv.slice(2);
if (!liveUrl || !mode) throw new Error("usage: shoot-live.mjs <play-url> play-opening|play-after|debug");
const out = join(dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(out, { recursive: true });
const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const base = new URL(liveUrl).origin;
const url = mode === "debug" ? `${liveUrl}/debug` : liveUrl;

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  for (const scheme of ["light", "dark"]) {
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      const tag = `${width}-${scheme}`;
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
      await ctx.addCookies([{ name: "stacks-theme", value: scheme, url: base }]);
      const page = await ctx.newPage();
      await page.goto(`${base}/`);
      await page.fill("#username", creds.username);
      await page.fill("#password", creds.password);
      await page.locator('form button[type="submit"]').first().click();
      await page.locator("#username").waitFor({ state: "detached", timeout: 15000 });
      await page.goto(url);
      if (mode === "debug") {
        await page.locator("[data-job-card]").first().waitFor({ timeout: 15000 });
        const cards = page.locator("[data-job-card]");
        // Select the last turn job: its card is the third on a two-turn session (turn, chronicle, turn, chronicle).
        const n = await cards.count();
        const target = n >= 3 ? cards.nth(2) : cards.first();
        await target.scrollIntoViewIfNeeded();
        await target.getByRole("button").first().click();
        await page.waitForTimeout(800);
        const hl = await page.locator("[data-seq][data-highlight=true]").count();
        console.log(`${hl > 0 ? "PASS" : "FAIL"} ${tag} highlight: ${hl} rows highlighted, ${n} job cards`);
      } else {
        await page.getByText(/Greyhollow Ford|bell/).first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(1500);
      }
      const modal = await page.locator("dialog[open],[aria-modal=true]").count();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`${modal === 0 ? "PASS" : "FAIL"} ${tag} no-modal: ${modal} dialogs`);
      console.log(`${over <= 0 ? "PASS" : "FAIL"} ${tag} no-overflow: ${over} px`);
      const file = join(out, `${mode}-${width}-${scheme}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(file);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
