import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const selected = args.includes("db")
  ? ["./node_modules/vitest/vitest.mjs", "run", "tests/db"]
  : args.includes("auth")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/auth/auth.test.ts"]
  : args.includes("workflow")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/db/workflow-boundary.test.ts"]
  : args.includes("ebook")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/imports/ebook.test.ts"]
  : args.includes("mediawiki")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/imports/mediawiki.test.ts"]
  : args.includes("pdf")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/imports/pdf.test.ts"]
  : args.includes("docx")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/imports/docx.test.ts"]
  : args.includes("ocr-queue")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/db/ocr-queue.test.ts"]
  : args.includes("import-text")
    ? ["./node_modules/vitest/vitest.mjs", "run", "tests/imports/import-text.test.ts"]
  : args.includes("fixtures") || args.length === 0
    ? ["--test", "test/fixtures.test.js"]
    : ["--test", ...args];

const result = spawnSync(process.execPath, selected, { stdio: "inherit" });
process.exit(result.status ?? 1);
