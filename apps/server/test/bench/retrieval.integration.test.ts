import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  ensureBenchDb,
  migrateBenchDb,
  resolveBenchUrl,
} from "../../src/bench/retrieval/db.js";
import {
  loadCorpus,
  loadMatrix,
  loadQuestions,
  matrixHash,
} from "../../src/bench/retrieval/load.js";
import { BaselineSchema } from "../../src/bench/retrieval/results.js";
import { runMatrix } from "../../src/bench/retrieval/run.js";
import { createDb, probeReachable } from "../../src/db.js";
import { jobs } from "../../src/schema/jobs.js";

/**
 * The per-commit recall regression gate (specs/019-retrieval-bench tasks.md
 * T020, US2, contract invariants 6-7). Runs the real CI matrix (`bow` only,
 * no network) against a REAL Postgres bench database and compares to the
 * committed baseline — this is the gate itself, not a fake stand-in for it.
 *
 * Pattern copied from retrieve.integration.test.ts (loud-skip harness).
 */

const BENCH_DIR = fileURLToPath(
  new URL("../../bench/retrieval", import.meta.url),
);

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const probeDb = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = probeDb ? await probeReachable(probeDb.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/bench/retrieval.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `This is the per-commit recall regression gate (spec 019 US2, constitution V); a skip ` +
    `here proves NOTHING about retrieval quality. Start one with: pnpm env:up, then set ` +
    `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await probeDb?.$client.end();
});

describe.skipIf(!reachable)(
  "retrieval bench — per-commit recall gate (US2, integration)",
  () => {
    it("T020: runs the CI matrix and holds every cell's recall@5 to baseline (invariants 6, 7)", async () => {
      const matrix = loadMatrix(path.join(BENCH_DIR, "matrices/ci.json"));
      const { books, hash: corpusHash } = loadCorpus(
        path.join(BENCH_DIR, "corpus"),
      );
      const { questions, hash: questionsHash } = loadQuestions(
        path.join(BENCH_DIR, "questions.json"),
        books,
      );
      const baseline = BaselineSchema.parse(
        JSON.parse(readFileSync(path.join(BENCH_DIR, "baseline.json"), "utf8")),
      );

      const currentMatrixHash = matrixHash(matrix);
      if (
        currentMatrixHash !== baseline.matrixHash ||
        corpusHash !== baseline.corpusHash ||
        questionsHash !== baseline.questionsHash
      ) {
        throw new Error(
          "corpus/questions/matrix changed; run --write-baseline",
        );
      }

      const { baseUrl, benchUrl } = resolveBenchUrl(process.env);
      await ensureBenchDb(baseUrl, benchUrl);
      await migrateBenchDb(benchUrl);
      const db = createDb(benchUrl);
      try {
        const rows = await runMatrix(
          {
            db,
            ai: { providers: {}, purposes: {}, prices: {} },
            env: process.env,
          },
          { matrix, books, questions },
        );

        const floor = 1 / questions.length;
        const failures: string[] = [];
        for (const row of rows) {
          const base = baseline.recall5[row.key];
          if (base === undefined) {
            failures.push(`cell "${row.key}" has no baseline entry`);
            continue;
          }
          if (row.recall5 < base - floor) {
            failures.push(
              `cell "${row.key}": recall@5 ${row.recall5.toFixed(3)} fell below ` +
                `baseline ${base.toFixed(3)} (floor ${(base - floor).toFixed(3)})`,
            );
          } else if (row.recall5 > base) {
            console.log(
              `notice: cell "${row.key}" beat its baseline (${row.recall5.toFixed(3)} > ` +
                `${base.toFixed(3)}); consider --write-baseline`,
            );
          }
        }
        expect(failures).toEqual([]);

        // Invariant 7: fts cells embed nothing (the null fields here are
        // the bench's own record of it; `retrieve.integration.test.ts`
        // T011 already proves `retrieve`'s fts path never calls
        // `gateway.embed`, and `runMatrix`'s fts pass calls that same
        // function un-wrapped).
        for (const row of rows.filter((r) => r.mode === "fts")) {
          expect(row.corpusEmbed).toBeNull();
          expect(row.questionEmbed).toBeNull();
        }

        // Invariant 6: the bench stores/embeds directly and never enqueues a job.
        const jobRows = await db.select().from(jobs);
        expect(jobRows).toHaveLength(0);
      } finally {
        await db.$client.end();
      }
    }, 120_000);
  },
);
