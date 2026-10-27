// Brave check of the turn-floor fixture on /play/fixtures/turn-floor, light and dark.
//
//   STACKS_SHOOT_CREDS=<json> PLAYWRIGHT_CORE=<a file inside a dir whose node_modules holds playwright-core>
//     node specs/049-turn-floor/evidence/shoot-floor.mjs [--out <dir>]
//
// Creds file (untracked, outside the repo): {"operator":{username,password}}, a TEST operator on the
// worktree's own stack. Steps shot (fixture seqs, see packages/session-model/src/fixtures/turn-floor.ts):
//   13  Ana is active: Ana sees End turn
//   24  round 2, a human DM seated, Ana active: the DM sees Pass and Take floor
//   25  the DM holds the floor: the DM sees Pass and Return floor; the badge says so
// Then it clicks through the controls (fixture mode appends local rows) and checks the strip moves.
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
const out = args.out ?? here;
const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const base = "http://localhost:3050";
const ANA = "00000000-0000-4000-8000-000000000001";
mkdirSync(out, { recursive: true });

let failed = 0;
const note = (tag, ok, text) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${tag}: ${text}`);
};
const url = (as, through) => `${base}/play/fixtures/turn-floor?as=${as}&through=${through}`;

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
    await ctx.addCookies([{ name: "stacks-theme", value: scheme, url: base }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/`);
    await page.fill("#username", creds.operator.username);
    await page.fill("#password", creds.operator.password);
    await page.locator('form button[type="submit"]').first().click();
    await page.locator("#username").waitFor({ state: "detached", timeout: 15000 });

    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await page.setViewportSize({ width, height });
      const tag = `${width}-${scheme}`;
      const shot = async (name) => {
        const file = join(out, `${name}-${tag}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(file);
      };
      const open = async (as, through) => {
        await page.goto(url(as, through));
        await page.getByRole("list", { name: "Turn order" }).waitFor({ timeout: 15000 });
        await page.waitForTimeout(500);
      };
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const header = async () => (await page.locator("header").first().innerText()).replace(/\s+/g, " ");

      // Active player.
      await open(ANA, 13);
      const strip = (await page.getByRole("list", { name: "Turn order" }).innerText()).replace(/\s+/g, " ");
      note(`${tag} active-strip`, /Ana.*you.*Bram.*next.*Pip.*Goblin/.test(strip), strip);
      note(`${tag} end-turn`, (await page.getByRole("button", { name: "End turn" }).count()) === 1, "End turn present");
      note(`${tag} no-dm-buttons`, (await page.getByRole("button", { name: /^(Pass|Take floor|Return floor)$/ }).count()) === 0, "no DM controls for a player");
      note(`${tag} no-dialog`, (await page.locator("dialog,[aria-modal]").count()) === 0, "no dialog or modal");
      note(`${tag} no-overflow`, (await overflow()) <= 0, `horizontal overflow ${await overflow()} px`);
      await shot("floor-active-player");

      if (width === 1280) {
        // Click End turn: the local rows move the strip to Bram and the control goes away.
        await page.getByRole("button", { name: "End turn" }).click();
        await page.waitForTimeout(500);
        const after = (await page.locator("li[aria-current='step']").innerText()).replace(/\s+/g, " ");
        note(`${tag} end-turn-click`, /Bram/.test(after) && (await page.getByRole("button", { name: "End turn" }).count()) === 0, `active now: ${after}`);

        // DM, floor free: Pass and Take floor. Click Take floor.
        await open("dm", 24);
        const dmButtons = await page.locator("header").first().getByRole("button").allInnerTexts();
        note(`${tag} dm-buttons`, dmButtons.includes("Pass") && dmButtons.includes("Take floor") && !dmButtons.includes("Return floor"), dmButtons.join(" | "));
        await shot("floor-dm-free");
        await page.getByRole("button", { name: "Take floor" }).click();
        await page.waitForTimeout(500);
        note(`${tag} take-click`, /The DM has the floor/.test(await header()) && (await page.getByRole("button", { name: "Return floor" }).count()) === 1, await header());
      }

      // Held floor.
      await open("dm", 25);
      const heldButtons = await page.locator("header").first().getByRole("button").allInnerTexts();
      note(`${tag} held-buttons`, heldButtons.includes("Pass") && heldButtons.includes("Return floor") && !heldButtons.includes("Take floor"), heldButtons.join(" | "));
      note(`${tag} held-badge`, /Turn mode · The DM has the floor/.test(await header()), await header());
      note(`${tag} held-line`, (await page.getByText("The DM has the floor", { exact: true }).count()) >= 1, "floor line in the transcript");
      note(`${tag} no-overflow-held`, (await overflow()) <= 0, `horizontal overflow ${await overflow()} px`);
      await shot("floor-held");
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
