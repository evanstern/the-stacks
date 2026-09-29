/**
 * The retrieval bench's agent-operable module API (constitution I,
 * contracts/bench-cli.md). Re-exports the pure and database-backed pieces
 * so a caller (a test, another script) never has to reach into individual
 * files.
 */

export {
  ensureBenchDb,
  migrateBenchDb,
  resetLibrary,
  resolveBenchUrl,
} from "./db.js";
export { bowEmbed, bowProvider, truncateVector, withDim } from "./embed.js";
export type { Matrix, Question, ResolvedQuestion } from "./load.js";
export {
  loadCorpus,
  loadMatrix,
  loadQuestions,
  MatrixSchema,
  matrixHash,
  QuestionSchema,
  QuestionSetSchema,
} from "./load.js";
export type { Baseline, Results } from "./results.js";
export {
  BaselineSchema,
  fmtCost,
  report,
  ResultsSchema,
  writeBaseline,
  writeResults,
} from "./results.js";
export type { BenchRow, Estimate, EstimateModel } from "./run.js";
export { estimate, runMatrix } from "./run.js";
export { scoreQuestion, summarize } from "./score.js";
