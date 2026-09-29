# Data model: Retrieval benchmark

No database schema change. Every entity below is a committed file or an in-memory value. The
bench database reuses the `library_*` tables unchanged (research R7).

## Corpus document (`apps/server/bench/retrieval/corpus/<doc>.md`)

SRD 5.1 text as Markdown. Book name = file stem. Parsed with `parseMarkdown`.
`corpusHash` = sha-256 over the sorted `<file name>\n<bytes>` pairs.

## Question (`apps/server/bench/retrieval/questions.json`)

```ts
const QuestionSchema = z.object({
  id: z.string().regex(/^q\d{3}$/),
  question: z.string().min(5),
  style: z.enum(["lexical", "paraphrase"]),
  expected: z.array(z.object({
    doc: z.string(),                 // corpus file stem
    quote: z.string().min(20).max(400),  // exact, unique in the parsed document text
  })).min(1),
});
const QuestionSetSchema = z.array(QuestionSchema).min(50);  // ids unique; ≥ half paraphrase
```

Resolved at load time to `{ id, question, style, targets: { doc, start, end }[] }`.
`questionsHash` = sha-256 of the file bytes.

## Matrix config (`apps/server/bench/retrieval/matrices/*.json`)

```ts
const MatrixSchema = z.object({
  name: z.string(),
  models: z.array(z.object({
    name: z.string(),                          // row label
    source: z.union([
      z.object({ builtin: z.literal("bow") }),
      z.object({ purpose: z.string() }),       // an AI_PURPOSES entry with op "embed"
    ]),
    dims: z.array(z.number().int().min(32).max(1024)).min(1),
  })).min(1),
  chunking: z.array(z.object({
    name: z.string(),
    maxChars: z.number().int().min(0),
  })).min(1),
  modes: z.array(z.enum(["vector", "fts", "hybrid"])).min(1),
  k: z.literal(10).default(10),                // retrieve depth; recall@1/5/10 derive from it
});
```

`matrixHash` = sha-256 of the canonical JSON (keys sorted) of the parsed config.

## Cell key

`<model>@<dim>|<chunking>|<mode>`. For `fts` the model part is `-`: `-|c2000|fts`.

## Row (one per cell)

```ts
interface BenchRow {
  key: string;
  model: string | null;          // null for fts
  embeddingModel: string | null; // model name the gateway reported, before the @dim suffix
  dim: number | null;
  dimMethod: "native" | "truncate" | null;
  chunking: string;
  maxChars: number;
  mode: "vector" | "fts" | "hybrid";
  chunks: number;                // chunks stored for this strategy
  questions: number;
  recall1: number; recall5: number; recall10: number;   // 0..1
  mrr10: number;                                        // 0..1
  latencyMs: { p50: number; p95: number };
  corpusEmbed: { tokens: number; costUsd: number | null } | null;    // null for fts
  questionEmbed: { tokens: number; costUsd: number | null } | null;  // null for fts
  misses: string[];              // question ids with no hit in top 10
}
```

`corpusEmbed` is shared by every mode row of the same (model, dim, chunking); each row repeats
it so a row reads alone.

## Bench run (results file)

See `contracts/results-format.md`.

## Baseline (`apps/server/bench/retrieval/baseline.json`)

```ts
interface Baseline {
  matrixHash: string;
  corpusHash: string;
  questionsHash: string;
  recall5: Record<string, number>;   // cell key → recall@5
}
```

Written only by `run --matrix matrices/ci.json --write-baseline`.
