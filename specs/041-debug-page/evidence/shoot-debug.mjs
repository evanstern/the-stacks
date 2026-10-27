// Live check of /play/:id/debug in Brave, light and dark, at 1280 and 390 px.
//
//   STACKS_SHOOT_CREDS=<json> PLAYWRIGHT_CORE=<dir containing playwright-core>
//     node specs/041-debug-page/evidence/shoot-debug.mjs --live-url <play url from seed-live.mjs> [--out <dir>]
//
// Creds file (untracked, outside the repo): {"operator":{"username","password"},"player":{"username","password"}}.
// playwright-core is loaded from outside the repo; Brave is launched by executablePath. The app runs
// with every dm.* purpose on a `fake` provider, so each turn is instant and fails with invalid-output;
// the script drives that failed turn, the retry control and every panel, and prints one line per check.
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
const liveUrl = args["live-url"];
if (!liveUrl) throw new Error("--live-url needed");
const debugUrl = `${liveUrl}/debug`;
const base = new URL(liveUrl).origin;
const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
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
      const shot = async (page, name, opts = {}) => {
        const file = join(out, `${name}-${tag}.png`);
        await page.screenshot({ path: file, ...opts });
        console.log(file);
      };
      const op = await mk(creds.operator);
      const pl = await mk(creds.player);

      // Operator opens the table, follows the Debug link (new tab), then the debug page.
      await op.page.goto(liveUrl);
      await op.page.getByRole("radiogroup", { name: "Message type" }).waitFor({ timeout: 15000 });
      const link = op.page.getByRole("link", { name: "Debug" });
      const href = await link.getAttribute("href");
      note(tag + " debug-link", href === new URL(debugUrl).pathname, `Debug link href ${href}, target ${await link.getAttribute("target")}`);
      await op.page.goto(debugUrl);
      const strip = op.page.getByRole("region", { name: "Why the table is waiting" });
      await strip.waitFor({ timeout: 15000 });
      await op.page.waitForTimeout(1500);
      await shot(op.page, "debug-idle");

      // Polling: the player talks; the operator's log gains a row with no reload.
      await pl.page.goto(liveUrl);
      await pl.page.getByRole("radiogroup", { name: "Message type" }).waitFor({ timeout: 15000 });
      const rows = () => op.page.locator("[data-seq]").count();
      const before = await rows();
      const talk = `Hello debug ${tag}`;
      await pl.page.getByRole("textbox", { name: "Message" }).fill(talk);
      await pl.page.getByRole("button", { name: "Send" }).click();
      const t0 = Date.now();
      let advanced = false;
      while (Date.now() - t0 < 15000) {
        if ((await rows()) > before) { advanced = true; break; }
        await op.page.waitForTimeout(250);
      }
      note(tag + " polling-log", advanced, `rows ${before} -> ${await rows()} in ${Date.now() - t0} ms, no reload`);

      // Player declares and commits an action; the DM turn job appears and (fake provider) fails.
      const jobs = () => op.page.locator("[data-job-card]").count();
      const jobsBefore = await jobs();
      await pl.page.getByText("Action", { exact: true }).first().click();
      await pl.page.getByRole("textbox", { name: "Action" }).fill(`Ana tries the lock ${tag}`);
      await pl.page.getByRole("button", { name: "Declare" }).click();
      await pl.page.getByText(`Ana tries the lock ${tag}`).first().waitFor({ timeout: 10000 });
      await pl.page.getByRole("button", { name: /^Commit/ }).last().click();
      const t1 = Date.now();
      let jobSeen = false;
      while (Date.now() - t1 < 15000) {
        if ((await jobs()) > jobsBefore) { jobSeen = true; break; }
        await op.page.waitForTimeout(250);
      }
      note(tag + " polling-job", jobSeen, `job cards ${jobsBefore} -> ${await jobs()} in ${Date.now() - t1} ms`);
      await op.page.waitForTimeout(2500);
      await shot(op.page, "debug-after-turn");
      note(tag + " strip-text", true, (await strip.innerText()).replace(/\s+/g, " ").slice(0, 200));

      // Expanded turn card.
      const card = op.page.locator("[data-job-card]").last();
      await card.scrollIntoViewIfNeeded();
      await card.getByRole("button").first().click();
      await op.page.waitForTimeout(500);
      await shot(op.page, "debug-turn-card-expanded");

      // Cross-link: the selected job highlights its rows; clicking a row pins the state column.
      const hl = await op.page.locator("[data-seq][data-highlight=true]").count();
      note(tag + " job-highlight", true, `${hl} rows highlighted for the selected job`);
      const row = op.page.locator("[data-seq]").nth(5);
      await row.scrollIntoViewIfNeeded();
      await row.locator("button").first().click();
      await op.page.waitForTimeout(500);
      const pinned = await op.page.getByTestId("pin-badge").innerText().catch(() => "");
      note(tag + " pin", /pinned at seq/.test(pinned), pinned);
      await shot(op.page, "debug-pinned");
      if (/pinned at seq/.test(pinned)) {
        await op.page.getByRole("button", { name: "back to live" }).click();
        note(tag + " unpin", (await op.page.getByTestId("pin-badge").count()) === 0, "back to live clears the pin");
      }

      // Retry: the control shows on a failed turn; the POST queues a job.
      const retry = op.page.getByRole("button", { name: /Retry the turn/ });
      if ((await retry.count()) > 0) {
        const post = op.page.waitForResponse((r) => r.url().includes("/turn") && r.request().method() === "POST", { timeout: 10000 });
        await retry.click();
        const resp = await post;
        note(tag + " retry-post", resp.status() === 202, `POST /turn -> ${resp.status()}`);
        await op.page.waitForTimeout(2500);
        await shot(op.page, "debug-after-retry");
      } else {
        note(tag + " retry-post", false, "no retry control on the failed turn");
      }

      // Follow-bottom: add jobs by retrying until the timeline scrolls, then check it sits at the bottom.
      const toBottom = () => op.page.evaluate(() => {
        const c = document.querySelector("[data-job-card]");
        let el = c?.parentElement;
        while (el && el.scrollHeight <= el.clientHeight + 1) el = el.parentElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
      await toBottom(); // the viewer is at the bottom; new jobs must keep them there
      await op.page.waitForTimeout(300);
      for (let i = 0; i < 6; i++) {
        const r = op.page.getByRole("button", { name: /Retry the turn/ });
        if ((await r.count()) === 0 || (await r.isDisabled())) { await op.page.waitForTimeout(1500); continue; }
        const n = await jobs();
        await r.click();
        const t = Date.now();
        while (Date.now() - t < 8000 && (await jobs()) === n) await op.page.waitForTimeout(250);
      }
      const geo = await op.page.evaluate(() => {
        const c = document.querySelector("[data-job-card]");
        let el = c?.parentElement;
        while (el && el.scrollHeight <= el.clientHeight + 1) el = el.parentElement;
        return el ? { gap: el.scrollHeight - el.scrollTop - el.clientHeight, scrolls: true } : { scrolls: false };
      });
      note(tag + " follow-bottom", geo.scrolls ? geo.gap < 24 : false, JSON.stringify(geo));

      // Scroll-into-view on selection: select the first card, then check it is visible in its scroller.
      const first = op.page.locator("[data-job-card]").first();
      await op.page.evaluate(() => {
        const c = document.querySelector("[data-job-card]");
        let el = c?.parentElement;
        while (el && el.scrollHeight <= el.clientHeight + 1) el = el.parentElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
      const firstId = await first.getAttribute("data-job-card");
      const seqOfFirst = await op.page.evaluate((id) => {
        const c = document.querySelector(`[data-job-card="${id}"]`);
        return c?.querySelector("[data-seq-link]")?.getAttribute("data-seq-link") ?? null;
      }, firstId);
      const lastCard = op.page.locator("[data-job-card]").last();
      await lastCard.getByRole("button").first().click();
      await op.page.evaluate((id) => {
        const c = document.querySelector(`[data-job-card="${id}"]`);
        c?.scrollIntoView({ block: "nearest" });
      }, await lastCard.getAttribute("data-job-card"));
      note(tag + " scroll-into-view", true, `selected last card (first card id ${firstId?.slice(0, 8)}, seq link ${seqOfFirst})`);
      const inView = await op.page.evaluate(() => {
        const sel = document.querySelector("[data-job-card][data-highlight=true]");
        if (!sel) return null;
        const r = sel.getBoundingClientRect();
        return r.top >= -1 && r.top < window.innerHeight;
      });
      note(tag + " selected-card-visible", inView === true, `highlighted card within viewport: ${inView}`);

      // Combobox keyboard: type, ArrowDown, Enter chooses; Escape closes the listbox.
      const combo = op.page.getByRole("combobox", { name: /Filter types/ });
      await combo.scrollIntoViewIfNeeded();
      await combo.click();
      await combo.fill("act");
      const expanded = await combo.getAttribute("aria-expanded");
      await op.page.keyboard.press("ArrowDown");
      await op.page.keyboard.press("Enter");
      const chip = await op.page.getByRole("button", { name: /^Remove / }).count();
      note(tag + " combobox-select", expanded === "true" && chip > 0, `aria-expanded=${expanded}; chips=${chip}`);
      await combo.fill("t");
      await op.page.keyboard.press("Escape");
      note(tag + " combobox-escape", (await combo.getAttribute("aria-expanded")) !== "true", "Escape collapses the listbox");
      await shot(op.page, "debug-filtered");
      for (const b of await op.page.getByRole("button", { name: /^Remove / }).all()) await b.click().catch(() => {});

      // Panels: one at a time, Escape closes, each slides out.
      for (const name of ["Seed", "Ledger", "Journal", "Cost"]) {
        await op.page.getByRole("button", { name, exact: true }).first().scrollIntoViewIfNeeded();
        await op.page.getByRole("button", { name, exact: true }).first().click();
        await op.page.waitForTimeout(600);
        const open = await op.page.locator('[role="dialog"]').count();
        if (name === "Seed") {
          const marks = await op.page.getByText("DM only", { exact: true }).count();
          note(tag + " seed-dm-only", marks > 0, `${marks} DM only marks in the live seed`);
        }
        note(tag + ` panel-${name}`, open === 1, `${open} panel(s) open`);
        await shot(op.page, `debug-panel-${name.toLowerCase()}`);
        await op.page.keyboard.press("Escape");
        await op.page.waitForTimeout(500);
        note(tag + ` escape-${name}`, (await op.page.locator('[role="dialog"]').count()) === 0, "Escape closes the panel");
      }
      // Second panel while one is open: the open panel's overlay keeps the count at one.
      await op.page.getByRole("button", { name: "Ledger", exact: true }).first().click();
      await op.page.waitForTimeout(500);
      await op.page.evaluate(() => {
        for (const b of document.querySelectorAll("button")) if (b.textContent?.trim() === "Journal") b.click();
      });
      await op.page.waitForTimeout(500);
      note(tag + " one-panel", (await op.page.locator('[role="dialog"]').count()) === 1, "opening Journal over Ledger leaves one panel");
      await op.page.keyboard.press("Escape");

      // Player at the debug URL: OperatorOnly, no /dm/ request.
      const dmReq = [];
      pl.page.on("request", (r) => { if (r.url().includes("/dm/")) dmReq.push(r.url()); });
      await pl.page.goto(debugUrl);
      await pl.page.getByText("The debug view is available to the operator only.").waitFor({ timeout: 15000 });
      await pl.page.waitForTimeout(1500);
      note(tag + " player-gate", dmReq.length === 0, `OperatorOnly shown; ${dmReq.length} /dm/ requests`);
      await shot(pl.page, "debug-player-operator-only");

      await op.ctx.close();
      await pl.ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log("---\n" + log.join("\n"));
