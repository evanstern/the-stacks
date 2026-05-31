import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, type Browser, type Locator } from "playwright";

import { epubImportAdapter, importMediaWikiApprovalManifest, mediaWikiPageImportAdapter, mobiImportAdapter } from "../app/lib/imports/adapters/index.js";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const password = "ikis-e2e-password";
const authSecret = "ikis-e2e-auth-secret-0000000000000000";

type FixtureImportStatus = {
  epub: string;
  mobi: string;
  mediawikiPageTitle: string;
  mediawikiCounts: {
    approved: number;
    rejected: number;
    deferred: number;
    pages: number;
    missing: number;
  };
};

async function main(): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), "ikis-e2e-"));
  const env = {
    ...process.env,
    IKIS_SHARED_PASSWORD: password,
    IKIS_AUTH_SECRET: authSecret,
    LANGGRAPH_ENABLED: "false",
    THE_STACKS_DB_PATH: join(tempDir, "ikis.sqlite"),
    IKIS_UPLOAD_DIR: join(tempDir, "uploads"),
    PUBLIC_URL: baseUrl,
  };
  let server: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    const fixtureStatus = await verifyFixtureImportsReachReviewStatus();
    server = startServer(env);
    await waitForServer();

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(`${baseUrl}/`);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();
    await page.getByRole("heading", { name: "ikis.ai" }).waitFor();

    await page.getByTestId("upload-input").setInputFiles(join(process.cwd(), "fixtures", "corpus", "sample.md"));
    await page.getByTestId("upload-submit").click();
    await page.getByText(/Review item created for human approval/).waitFor();

    await page.getByRole("link", { name: "Review queue" }).click();
    await page.getByTestId("review-queue").waitFor();
    await page.getByText("Suggest approve").waitFor();
    await page.getByTestId("review-approve").first().click();
    await page.getByText("Human decision recorded: approved.").waitFor();

    await page.goto(`${baseUrl}/chat`);
    await page.getByTestId("chat-question").fill("What does the approved corpus say about three brass lamps and the chalk mark?");
    await page.getByTestId("chat-submit").click();
    const answer = page.getByTestId("chat-answer");
    await answer.waitFor();
    await page.getByText(/Based on approved corpus evidence/).waitFor();
    await expectText(answer, /three brass lamps/i);
    await page.getByTestId("citation-link").first().click();
    await page.getByTestId("source-preview").waitFor();

    if (consoleErrors.length > 0) {
      throw new Error(`Browser console errors: ${consoleErrors.join("\n")}`);
    }

    console.log("Ikis e2e passed", JSON.stringify(fixtureStatus));
  } finally {
    if (browser) {
      await browser.close();
    }

    if (server) {
      server.kill("SIGTERM");
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
}

function startServer(env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn("pnpm", ["exec", "react-router", "dev", "--host", "127.0.0.1", "--port", "4173"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });

      if (response.status === 302 || response.ok) {
        return;
      }
    } catch {
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function verifyFixtureImportsReachReviewStatus(): Promise<FixtureImportStatus> {
  const fixtureRoot = join(process.cwd(), "fixtures");
  const [epubBytes, mobiBytes, pageBytes, manifestBytes] = await Promise.all([
    readFile(join(fixtureRoot, "corpus", "sample.epub")),
    readFile(join(fixtureRoot, "corpus", "sample.mobi")),
    readFile(join(fixtureRoot, "mediawiki", "simple-page.json")),
    readFile(join(fixtureRoot, "mediawiki", "approval-manifest.json")),
  ]);

  const [epubResult, mobiResult, pageResult, manifestResult] = await Promise.all([
    epubImportAdapter.import({ filename: "sample.epub", bytes: new Uint8Array(epubBytes), sourceId: "e2e-epub-source" }),
    mobiImportAdapter.import({ filename: "sample.mobi", bytes: new Uint8Array(mobiBytes), sourceId: "e2e-mobi-source" }),
    mediaWikiPageImportAdapter.import({ filename: "simple-page.json", bytes: new Uint8Array(pageBytes), sourceId: "e2e-mediawiki-source" }),
    importMediaWikiApprovalManifest({
      manifest: { filename: "approval-manifest.json", bytes: new Uint8Array(manifestBytes) },
      pages: [{ filename: "simple-page.json", bytes: new Uint8Array(pageBytes) }],
    }),
  ]);

  if (epubResult.documents.length !== 1 || mobiResult.documents.length !== 1) {
    throw new Error("EPUB/MOBI fixtures did not normalize to reviewable documents.");
  }

  if (manifestResult.counts.approved !== 2 || manifestResult.counts.rejected !== 1 || manifestResult.counts.deferred !== 1) {
    throw new Error("MediaWiki manifest parity counts changed.");
  }

  return {
    epub: "review_needed",
    mobi: "review_needed",
    mediawikiPageTitle: pageResult.documents[0]?.title ?? "missing",
    mediawikiCounts: manifestResult.counts,
  };
}

async function expectText(locator: Locator, expected: RegExp): Promise<void> {
  const text = await locator.textContent();

  if (!text || !expected.test(text)) {
    throw new Error(`Expected ${expected} in ${text ?? "empty text"}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
