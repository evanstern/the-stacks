// Screenshots of the play table in Brave, light and dark, at 1280 and 390 px.
//
//   STACKS_SHOOT_CREDS=<json file> node specs/030-play-route/evidence/shoot.mjs --mode fixtures|live
//     [--base http://localhost:3047] [--out <dir>] [--live-url <url>]
//
// The creds file is untracked: {"operator":{"username","password"},"player":{"username","password"}}.
// playwright-core is loaded from outside the repo (never from any package.json): set
// PLAYWRIGHT_CORE to its directory. Brave is launched by executablePath; no other browser.
//
// `--mode fixtures` needs the signed-in operator only. `--mode live` signs in both accounts and
// drives talk, declare, comment and commit through the UI on a fresh table, then captures the
// same four surfaces.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fixtureIds,
  fixtures,
} from "../../../packages/session-model/dist/fixtures/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, a, i, all) => {
      if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
      return acc;
    }, []),
);
const mode = args.mode ?? "fixtures";
const root = join(here, "../../..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = args.base ?? `http://localhost:${env.APP_PORT ?? 3000}`;
const out = args.out ?? join(here, "shots");
const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
mkdirSync(out, { recursive: true });

const WIDTHS = [
  [1280, 800],
  [390, 844],
];
const SCHEMES = ["light", "dark"];

async function signIn(page, who) {
  await page.goto(`${base}/`);
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.locator('form button[type="submit"]').first().click();
  await page.locator("#username").waitFor({ state: "detached", timeout: 15000 });
}

const seqOf = (fixtureName, type, nth = 0) =>
  fixtures
    .find((f) => f.name === fixtureName)
    .events.filter((e) => e.type === type)[nth].seq;

const P1 = fixtureIds.playerUserId;
const surfaces =
  mode === "fixtures"
    ? [
        {
          name: "free-mode-open-action-player",
          url: `/play/fixtures/free-mode-action?as=${P1}&through=${seqOf("free-mode-action", "action.declared")}`,
        },
        {
          name: "turn-mode-anas-turn",
          url: `/play/fixtures/turn-mode-combat?as=${P1}&through=${seqOf("turn-mode-combat", "table-mode.changed")}`,
        },
        {
          name: "ledger-panel",
          url: `/play/fixtures/free-mode-action?as=${P1}`,
          open: "Ledger",
        },
        {
          name: "approvals-panel-dm",
          url: `/play/fixtures/free-mode-action?as=dm`,
          open: "Pending proposals",
        },
      ]
    : null;

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  if (mode === "fixtures") {
    for (const scheme of SCHEMES) {
      for (const [width, height] of WIDTHS) {
        const ctx = await browser.newContext({
          viewport: { width, height },
          colorScheme: scheme,
        });
        const page = await ctx.newPage();
        await signIn(page, creds.operator);
        for (const s of surfaces) {
          await page.goto(`${base}${s.url}`);
          await page.getByRole("radiogroup", { name: "Message type" }).waitFor({ timeout: 15000 });
          if (s.open) {
            await page.getByRole("button", { name: new RegExp(s.open) }).first().click();
            await page.waitForTimeout(400);
          }
          const file = join(out, `${s.name}-${width}-${scheme}.png`);
          await page.screenshot({ path: file });
          console.log(file);
        }
        await ctx.close();
      }
    }
  } else {
    // live: operator and player drive a seeded table (seed-live.mjs; pass its URL as --live-url).
    const url = args["live-url"];
    if (!url) throw new Error("--mode live needs --live-url from seed-live.mjs");
    const log = [];
    for (const scheme of SCHEMES) {
      for (const [width, height] of WIDTHS) {
        const tag = `${width}-${scheme}`;
        const mk = async (who) => {
          const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
          const page = await ctx.newPage();
          await signIn(page, who);
          await page.goto(url);
          await page.getByRole("radiogroup", { name: "Message type" }).waitFor({ timeout: 15000 });
          return { ctx, page };
        };
        const op = await mk(creds.operator);
        const pl = await mk(creds.player);
        const talk = `Hello table ${tag}`;
        const act = `Ana tries the lock ${tag}`;
        await pl.page.getByRole("textbox", { name: "Message" }).fill(talk);
        await pl.page.getByRole("button", { name: "Send" }).click();
        await op.page.getByText(talk).first().waitFor({ timeout: 10000 });
        await pl.page.getByText(talk).first().waitFor({ timeout: 10000 });
        log.push(`${tag}: talk visible to both`);
        await pl.page.getByText("Action", { exact: true }).first().click();
        await pl.page.getByRole("textbox", { name: "Action" }).fill(act);
        await pl.page.getByRole("button", { name: "Declare" }).click();
        await op.page.getByText(act).first().waitFor({ timeout: 10000 });
        log.push(`${tag}: declared action visible to both`);
        await op.page.getByPlaceholder("Comment on this action").last().fill(`ok ${tag}`);
        await op.page.getByRole("button", { name: "Comment", exact: true }).last().click();
        await pl.page.getByText(`ok ${tag}`).first().waitFor({ timeout: 10000 });
        log.push(`${tag}: comment visible to both`);
        await pl.page.getByRole("button", { name: /^Commit/ }).last().click();
        await op.page.getByText(/Committed/).last().waitFor({ timeout: 10000 });
        log.push(`${tag}: commit visible to both`);
        for (const [who, name] of [[op, "operator"], [pl, "player"]]) {
          const file = join(out, `live-${name}-${tag}.png`);
          await who.page.screenshot({ path: file });
          console.log(file);
        }
        await op.ctx.close();
        await pl.ctx.close();
      }
    }
    console.log(log.join("\n"));
  }
} finally {
  await browser.close();
}
