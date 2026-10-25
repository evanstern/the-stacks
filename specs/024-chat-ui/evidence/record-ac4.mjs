#!/usr/bin/env node
// AC #4 recording (plan D16, research R13): drives quickstart.md §6's piloted
// two-browser run and records each browser context to webm.
//
// Install (once, out of tree — never add this to any package.json):
//   mkdir -p /Users/evanstern/.claude/jobs/a48ac8bd/tmp && cd $_
//   npm init -y >/dev/null && npm install playwright-core@1.63.0
//
// Run (from the repo root, with the worktree's stack up — quickstart.md §1-3):
//   APP_PORT=$APP_PORT OPERATOR_PASSWORD="$OPERATOR_PASSWORD" \
//     PLAYER_PASSWORD="$PLAYER_PASSWORD" \
//     node specs/024-chat-ui/evidence/record-ac4.mjs
//
// PLAYWRIGHT_DIR overrides the out-of-tree playwright-core location (default
// below). Credentials are read from the environment only and are never
// printed, logged, or written to a file by this script.

import { createRequire } from "node:module";
import { readdirSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLAYWRIGHT_DIR =
  process.env.PLAYWRIGHT_DIR ?? "/Users/evanstern/.claude/jobs/a48ac8bd/tmp";
const require = createRequire(join(PLAYWRIGHT_DIR, "package.json"));
const { chromium } = require("playwright-core");

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const EVIDENCE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_PORT = process.env.APP_PORT;
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD;
const PLAYER_PASSWORD = process.env.PLAYER_PASSWORD;
if (!APP_PORT || !OPERATOR_PASSWORD || !PLAYER_PASSWORD) {
  console.error(
    "Set APP_PORT, OPERATOR_PASSWORD, and PLAYER_PASSWORD in the environment.",
  );
  process.exit(1);
}
const BASE = `http://localhost:${APP_PORT}`;
const TABLE_ID = crypto.randomUUID();
const CORPUS = "apps/server/bench/retrieval/corpus/conditions.md";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const beat = () => pause(700); // human-watchable pace between steps

async function signIn(page, username, password) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.fill("#username", username);
  await page.fill("#password", password);
  await beat();
  await page.click('button[type=submit]');
  await page.waitForLoadState("networkidle");
  await beat();
}

async function joinTable(page, tableId) {
  // The Table landing (routes/table.tsx) is mounted at the "/play" path
  // (routes.ts); "/play/:sessionId" (routes/play.tsx) is the live session.
  await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
  await page.fill("#join-table", tableId);
  await beat();
  await page.click('button:has-text("Join")');
  await page.waitForURL(`**/play/${tableId}`);
  await beat();
}

async function sendMessage(page, text) {
  const input = page.locator("form input").first();
  await input.fill(text);
  await beat();
  await page.click('button:has-text("Send")');
  await page.waitForSelector(`li:has-text("${text}")`, { timeout: 10_000 });
  await beat();
}

async function renameVideo(page, outName) {
  const video = page.video();
  if (!video) return;
  const from = await video.path();
  renameSync(from, join(EVIDENCE_DIR, outName));
}

async function run() {
  const browser = await chromium.launch({
    executablePath: BRAVE,
    headless: true,
  });

  const opCtx = await browser.newContext({
    recordVideo: { dir: EVIDENCE_DIR, size: { width: 960, height: 600 } },
  });
  const plCtx = await browser.newContext({
    recordVideo: { dir: EVIDENCE_DIR, size: { width: 960, height: 600 } },
  });
  const op = await opCtx.newPage();
  const pl = await plCtx.newPage();

  const libraryRequests = [];
  pl.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/library")) {
      libraryRequests.push(req.url());
    }
  });

  // 1. Operator signs in — lands on /ask with the full sidebar.
  await signIn(op, "operator", OPERATOR_PASSWORD);

  // 2. Player signs in — lands on the Table landing, Table-only sidebar.
  await signIn(pl, "player", PLAYER_PASSWORD);

  // 3-4. Both join the same table by pasting its id.
  await joinTable(pl, TABLE_ID);
  await joinTable(op, TABLE_ID);

  // 5-6. Exchange messages, each appears in both windows.
  await sendMessage(op, "hello from the operator");
  await pl.waitForSelector('li:has-text("hello from the operator")');
  await sendMessage(pl, "hello from the player");
  await op.waitForSelector('li:has-text("hello from the player")');

  // 7. Operator uploads the Conditions fixture in Library.
  await op.goto(`${BASE}/books`, { waitUntil: "networkidle" });
  await op.setInputFiles('input[type=file]', CORPUS);
  await beat();
  await op.fill("#book-title", "Conditions");
  await beat();
  await op.click('button:has-text("Upload")');
  await op.waitForSelector('text=/Ready|Search-only/', { timeout: 30_000 });
  await beat();

  // 8. Operator asks a question in Ask and opens a citation.
  await op.goto(`${BASE}/ask`, { waitUntil: "networkidle" });
  await op.fill("#ask-question", "How does grappling work?");
  await beat();
  await op.click('button:has-text("Ask")');
  await op.waitForSelector(".citation", { timeout: 30_000 });
  await beat();
  await op.locator(".citation").first().click();
  await beat();

  // 9. Player's Table view still shows no book text.
  const playerBody = await pl.textContent("body");
  const leaked = ["grappling", "Conditions", "Citation"].filter((s) =>
    playerBody.includes(s),
  );
  if (leaked.length) {
    throw new Error(`Player page leaked book text: ${leaked.join(", ")}`);
  }
  await beat();

  // 10-11. Player is refused /ask and /books.
  await pl.goto(`${BASE}/ask`, { waitUntil: "networkidle" });
  await pl.waitForSelector("text=Asking the library is available to the operator only.");
  await beat();
  await pl.goto(`${BASE}/books`, { waitUntil: "networkidle" });
  await pl.waitForSelector("text=The library is available to the operator only.");
  await beat();

  // 12. Operator returns to Table; history intact.
  await op.goto(`${BASE}/play/${TABLE_ID}`, { waitUntil: "networkidle" });
  await op.waitForSelector('li:has-text("hello from the operator")');
  await op.waitForSelector('li:has-text("hello from the player")');
  await beat();

  await opCtx.close();
  await plCtx.close();
  await renameVideo(op, "ac4-operator.webm");
  await renameVideo(pl, "ac4-player.webm");
  await browser.close();

  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    join(EVIDENCE_DIR, "ac4-player-requests.txt"),
    `player /library requests: ${libraryRequests.length}\n`,
  );

  console.log("Recorded ac4-operator.webm and ac4-player.webm.");
  console.log(`player /library requests: ${libraryRequests.length}`);
  for (const dirent of readdirSync(EVIDENCE_DIR)) {
    if (dirent.endsWith(".webm")) {
      const { size } = statSync(join(EVIDENCE_DIR, dirent));
      console.log(`${dirent}: ${(size / 1024 / 1024).toFixed(2)} MB`);
    }
  }
}

run().catch((err) => {
  console.error("RECORDING_FAILED", err);
  process.exit(1);
});
