// Brave run of the human DM seat on a worktree stack (spec 062 Phase 5, quickstart steps 3-13).
//
//   PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core>
//     node specs/062-human-dm-seat/evidence/shoot-live.mjs <creds-file>
//
// <creds-file> is untracked and outside the repo: {"operator": {"username","password"}}. The operator
// account already exists on the stack. The script generates the ana and bram passwords, redeems two
// invitations, and writes both accounts back into <creds-file>. Three browser contexts (operator, ana,
// bram). It prints one PASS/FAIL/INFO line per check and never prints a password or a token.
// Shots: shots/<name>-<width>-<scheme>.png at 1280 and 390 px, light and dark.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [credsPath] = process.argv.slice(2);
if (!credsPath) {
  console.error("usage: shoot-live.mjs <creds-file>");
  process.exit(2);
}
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const pw = () => randomBytes(18).toString("base64url");
if (!creds.ana) creds.ana = { username: "ana", displayName: "Ana", password: pw() };
if (!creds.bram) creds.bram = { username: "bram", displayName: "Bram", password: pw() };
writeFileSync(credsPath, JSON.stringify(creds), { mode: 0o600 });

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "shots");
mkdirSync(out, { recursive: true });
const env = Object.fromEntries(
  readFileSync(join(here, "../../../.env"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const host = `localhost:${env.APP_PORT ?? "3000"}`;
const base = `http://${host}`;
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const VARIANTS = [
  [1280, 800, "light"],
  [1280, 800, "dark"],
  [390, 844, "light"],
  [390, 844, "dark"],
];
const check = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
const info = (s) => console.log(`INFO ${s}`);

async function shoot(page, name, variants = VARIANTS) {
  for (const [w, h, scheme] of variants) {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme);
    await page.waitForTimeout(400);
    const modal = await page.locator("dialog[open],[aria-modal=true]").count();
    check(modal === 0, `${name} ${w}-${scheme} no-modal: ${modal} dialogs`);
    await page.screenshot({ path: join(out, `${name}-${w}-${scheme}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}

async function signIn(page, who) {
  await page.goto(`${base}/`);
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.locator('form button[type="submit"]').first().click();
  await page.locator("#username").waitFor({ state: "detached", timeout: 15000 });
}

async function redeem(page, token, who) {
  await page.goto(`${base}/`);
  await page.getByRole("button", { name: "Have an invitation?" }).click();
  await page.locator("#invite-token").waitFor({ timeout: 10000 });
  await page.fill("#invite-token", token);
  await page.fill("#invite-username", who.username);
  await page.fill("#invite-display-name", who.displayName);
  await page.fill("#invite-password", who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.locator("#invite-token").waitFor({ state: "detached", timeout: 15000 });
}

// One hand-sent frame; resolves with the first error frame or null after a quiet period.
function sendFrame(cookie, sessionId, eventType, payload) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${host}/ws`, { headers: { cookie } });
    const timer = setTimeout(() => { ws.close(); resolve(null); }, 6000);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "subscribe", sessionId, afterSeq: 0 })));
    ws.addEventListener("message", (msg) => {
      const f = JSON.parse(String(msg.data));
      if (f.type === "replay-complete") {
        ws.send(JSON.stringify({ type: "send", sessionId, eventType, payload, payloadVersion: 1 }));
      } else if (f.type === "error") {
        clearTimeout(timer); ws.close(); resolve(f);
      }
    });
  });
}
const cookieOf = async (ctx) => (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
let sessionId;
try {
  const [ctxA, ctxB, ctxC] = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 1280, height: 800 } })));
  const [op, ana, bram] = await Promise.all([ctxA.newPage(), ctxB.newPage(), ctxC.newPage()]);

  // Step 3: operator signs in, two invitations, ana and bram redeem.
  await signIn(op, creds.operator);
  const tokens = [];
  if (creds.redeemed) {
    await signIn(ana, creds.ana);
    await signIn(bram, creds.bram);
  } else {
  await op.goto(`${base}/settings`);
  for (let i = 0; i < 2; i++) {
    const before = await op.getByLabel("Invitation token").inputValue().catch(() => "");
    await op.getByRole("button", { name: "Create invitation" }).click();
    await op.waitForFunction(
      (prev) => {
        const el = [...document.querySelectorAll("input")].find((x) => x.getAttribute("aria-label") === "Invitation token" || x.labels?.[0]?.textContent?.includes("Invitation token"));
        return el && el.value && el.value !== prev;
      },
      before,
      { timeout: 10000 },
    );
    tokens.push(await op.getByLabel("Invitation token").inputValue());
  }
  await redeem(ana, tokens[0], creds.ana);
  await redeem(bram, tokens[1], creds.bram);
  creds.redeemed = true;
  writeFileSync(credsPath, JSON.stringify(creds), { mode: 0o600 });
  }
  check(true, `step 3 ana and bram ${tokens.length ? "redeemed from two invitations" : "signed in (accounts exist)"}`);
  const me = async (cx) => (await (await cx.request.get(`${base}/auth/me`)).json()).user;
  const [uOp, uAna, uBram] = await Promise.all([ctxA, ctxB, ctxC].map(me));

  // Step 4: new table, three open it.
  await op.goto(`${base}/play`);
  await op.getByRole("button", { name: "Start a new table" }).click();
  await op.waitForURL(/\/play\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const playUrl = op.url();
  sessionId = playUrl.split("/").pop();
  info(`session ${sessionId}`);
  await ana.goto(playUrl);
  await bram.goto(playUrl);
  const strip = op.getByRole("list", { name: "At the table" });
  await strip.waitFor({ timeout: 15000 });
  await op.getByText("Ana").first().waitFor({ timeout: 15000 });
  await op.getByText("Bram").first().waitFor({ timeout: 15000 });
  const names = await strip.innerText();
  check(/Ana/.test(names) && /Bram/.test(names) && names.split("\n").filter(Boolean).length >= 3, `step 4 presence strip shows three names: ${names.replace(/\s+/g, " ")}`);

  // Step 5: AI holds the seat.
  await op.getByRole("button", { name: "DM seat" }).click();
  await op.getByText("AI DM holds the seat.").waitFor({ timeout: 10000 });
  const opts5 = await op.locator("#dm-seat-pick option").allInnerTexts();
  info(`step 5 options: ${opts5.join(" | ")}`);
  check(opts5.some((t) => /\(you\)/.test(t)) && opts5.some((t) => t.includes("Ana")) && opts5.some((t) => t.includes("Bram")), "step 5 select lists operator (you), Ana, Bram");
  check((await op.getByRole("button", { name: "Return the seat to the AI DM" }).count()) === 0, "step 5 no Return button");
  check((await op.getByLabel("Seat a human DM").count()) === 1, "step 5 select named Seat a human DM");
  await shoot(op, "panel-ai");

  // Step 6: seat the operator.
  await op.locator("#dm-seat-pick").selectOption({ label: opts5.find((t) => /\(you\)/.test(t)) });
  await op.getByRole("button", { name: "Seat as DM" }).click();
  await op.getByRole("button", { name: /Pending proposals/ }).waitFor({ timeout: 15000 });
  check((await op.locator("#dm-seat-panel").count()) === 0 || !(await op.locator("#dm-seat-panel").isVisible()), "step 6 panel closed");
  check((await op.getByRole("button", { name: "Change scene" }).count()) === 1 && (await op.getByRole("button", { name: "Table mode" }).count()) === 1, "step 6 header has Pending proposals, Change scene, Table mode");
  info(`step 6 strip: ${(await strip.innerText()).replace(/\s+/g, " ")}`);

  // Step 7: Start scene.
  await op.getByRole("button", { name: "Start scene" }).click();
  await op.locator("#start-seed").waitFor({ timeout: 15000 });
  await op.locator("#start-seed").selectOption("greyhollow-ford");
  const sel = op.locator("#start-seat-tamsin");
  await sel.waitFor({ timeout: 10000 });
  const labels = await sel.locator("option").allInnerTexts();
  const opLabel = labels.find((t) => /\(you\)|operator/i.test(t));
  const anaLabel = labels.find((t) => t.includes("Ana"));
  info(`step 7 tamsin options: ${labels.join(" | ")}`);
  const start = op.getByRole("button", { name: "Start", exact: true });
  if (opLabel) await sel.selectOption({ label: opLabel });
  await op.waitForTimeout(500);
  check(!!opLabel && (await op.getByText("The DM cannot hold a character seat.").count()) > 0, "step 7 operator on Tamsin: issue shown");
  check(await start.isDisabled(), "step 7 Start disabled with the DM on Tamsin");
  await shoot(op, "start-dm-seat-issue", [[1280, 800, "light"]]);
  await sel.selectOption({ label: anaLabel });
  await op.waitForTimeout(300);
  check(await start.isEnabled(), "step 7 Start enabled with Ana on Tamsin");
  await start.click();
  await op.getByText("Scene start waiting for the DM.").first().waitFor({ timeout: 15000 }).then(
    () => check(true, "step 7 header: Scene start waiting for the DM."),
    () => check(false, "step 7 header: Scene start waiting for the DM."),
  );

  // Step 8: carry out the suggestion from Change scene; approve all but the tracker.
  await op.waitForTimeout(6000);
  await op.getByRole("button", { name: "Change scene" }).click();
  await op.locator("#scene-id").waitFor({ timeout: 15000 });
  check((await op.locator("#scene-id").inputValue()) === "greyhollow-ford", "step 8 Change scene seeded: greyhollow-ford");
  await op.getByRole("button", { name: "Apply", exact: true }).click();
  await op.getByText("The Bell at Greyhollow Ford").first().waitFor({ timeout: 15000 });
  await op.waitForTimeout(2500);
  await op.getByRole("button", { name: /Pending proposals/ }).click();
  await op.getByRole("button", { name: "Approve" }).first().waitFor({ timeout: 15000 });
  const rows = await op.locator("ul > li").filter({ has: op.getByRole("button", { name: "Approve" }) }).count();
  info(`step 8 approvable rows: ${rows}`);
  let approved = 0;
  for (let n = 0; n < 20; n++) {
    const row = op.locator("ul > li").filter({ has: op.getByRole("button", { name: "Approve" }) }).filter({ hasNotText: /tracker/i }).first();
    if ((await row.count()) === 0) break;
    const c = await op.getByRole("button", { name: "Approve" }).count();
    await row.getByRole("button", { name: "Approve" }).click();
    await op.waitForFunction((k) => [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "Approve").length < k, c, { timeout: 15000 });
    approved++;
  }
  const left = await op.getByRole("button", { name: "Approve" }).count();
  info(`step 8 approved ${approved}; ${left} Approve buttons left`);
  const leftText = await op.locator("ul > li").filter({ has: op.getByRole("button", { name: "Approve" }) }).allInnerTexts();
  info(`step 8 pending rows: ${leftText.map((t) => t.replace(/\s+/g, " ").slice(0, 80)).join(" || ")}`);
  await op.waitForTimeout(3000);
  await op.getByRole("button", { name: "Close" }).last().click().catch(() => {});
  await op.waitForTimeout(800);
  const pendingBtn = (await op.getByRole("button", { name: /Pending proposals \(\d+\)/ }).innerText()).replace(/\s+/g, " ");
  info(`step 8 header: ${pendingBtn}`);

  // Step 9: hand-over panel.
  await op.getByRole("button", { name: "DM seat" }).click();
  await op.getByText(/holds the seat\./).first().waitFor({ timeout: 10000 });
  const holder9 = await op.locator("#dm-seat-panel").innerText().catch(() => "");
  const opts9 = await op.locator("#dm-seat-pick option").allInnerTexts();
  info(`step 9 holder text: ${holder9.replace(/\s+/g, " ").slice(0, 200)}`);
  info(`step 9 options: ${opts9.join(" | ")}`);
  check(opts9.filter((t) => t !== "Choose a person").length === 1 && opts9.some((t) => t.includes("Bram")), "step 9 select lists Bram only");
  check((await op.getByRole("button", { name: "Return the seat to the AI DM" }).count()) === 1, "step 9 Return button shown");
  check((await op.getByText(/Pending proposals stay pending under the AI DM: \d+\. Decide them first\./).count()) === 1, "step 9 pending warning shown");
  await shoot(op, "panel-human");

  // Step 10: hand to Bram.
  await op.locator("#dm-seat-reason").fill("The operator hands the seat to Bram");
  await op.locator("#dm-seat-pick").selectOption({ label: opts9.find((t) => t.includes("Bram")) });
  check((await bram.getByRole("button", { name: /Pending proposals/ }).count()) === 0, "step 10 before: Bram has no Pending proposals");
  await op.getByRole("button", { name: "Seat as DM" }).click();
  await bram.getByRole("button", { name: /Pending proposals/ }).waitFor({ timeout: 20000 });
  const bp = (await bram.getByRole("button", { name: /Pending proposals/ }).innerText()).replace(/\s+/g, " ");
  check(/\(\d+\)/.test(bp), `step 10 Bram sees ${bp} without reload`);
  check((await bram.getByRole("button", { name: "Change scene" }).count()) === 1 && (await bram.getByRole("button", { name: "Table mode" }).count()) === 1, "step 10 Bram has Change scene and Table mode");
  await bram.getByRole("button", { name: /Pending proposals/ }).click();
  await bram.waitForTimeout(800);
  const bt = (await bram.locator("ul").allInnerTexts()).join(" ").replace(/\s+/g, " ");
  info(`step 10 Bram pending text: ${bt.slice(0, 200)}`);
  check(/tracker/i.test(bt), "step 10 Bram's pending item is the tracker suggestion");
  await bram.getByRole("button", { name: "Close" }).last().click().catch(() => {});
  await op.waitForTimeout(1500);
  check((await op.getByRole("button", { name: /Pending proposals/ }).count()) === 0, "step 10 operator: no Pending proposals");
  await shoot(bram, "bram-dm");

  // Step 12: return the seat. (Step 11 read below, after both presses.)
  await op.getByRole("button", { name: "DM seat" }).click().catch(() => {});
  await op.getByText(/holds the seat\./).first().waitFor({ timeout: 10000 });
  const t12 = await op.locator("#dm-seat-panel").innerText().catch(() => "");
  info(`step 12 panel: ${t12.replace(/\s+/g, " ").slice(0, 200)}`);
  check(/Bram holds the seat\./.test(t12), "step 12 Bram holds the seat.");
  check(!/Pending proposals stay pending/.test(t12), "step 12 no pending warning (operator not seated)");
  await op.getByRole("button", { name: "Return the seat to the AI DM" }).click();
  await bram.getByRole("button", { name: /Pending proposals/ }).waitFor({ state: "detached", timeout: 20000 }).then(
    () => check(true, "step 12 Bram drops to the player view"),
    () => check(false, "step 12 Bram drops to the player view"),
  );
  await op.waitForTimeout(1500);
  const strip12 = (await op.getByRole("list", { name: "At the table" }).innerText()).replace(/\s+/g, " ");
  info(`step 12 strip: ${strip12}`);
  check(/AI DM/.test(strip12), "step 12 presence strip shows the AI DM");
  await shoot(op, "returned");

  // Step 11: debug rows.
  await op.goto(`${playUrl}/debug`);
  await op.waitForTimeout(4000);
  const dbg = await op.locator("body").innerText();
  const seatRows = dbg.split("\n").filter((l) => /dm\.seat\.changed/.test(l));
  info(`step 11 dm.seat.changed rows: ${seatRows.map((r) => r.trim().slice(0, 120)).join(" || ")}`);
  writeFileSync(join(out, "../debug-page.txt"), dbg.slice(0, 20000));

  // Step 13: ana has no DM seat control.
  await ana.goto(playUrl);
  await ana.getByText("Ledger").first().waitFor({ timeout: 15000 });
  await ana.waitForTimeout(2000);
  check((await ana.getByRole("button", { name: "DM seat" }).count()) === 0, "step 13 Ana has no DM seat button");
  await shoot(ana, "player-no-control", [[1280, 800, "light"]]);

  // Expected refusals.
  const r1 = await sendFrame(await cookieOf(ctxB), sessionId, "dm.seat", { reason: "A player tries", after: { kind: "human", userId: uAna.id } });
  check(r1?.code === "NOT_AUTHORIZED", `refusal player dm.seat: ${r1 ? r1.code : "no error frame"}`);
  const r2 = await sendFrame(await cookieOf(ctxA), sessionId, "dm.seat", { reason: "Bad user id", after: { kind: "human", userId: "not-a-uuid" } });
  check(r2?.code === "INVALID_PROPOSAL", `refusal non-uuid userId: ${r2 ? r2.code : "no error frame"}`);
} finally {
  await browser.close();
}
