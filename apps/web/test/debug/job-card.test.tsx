import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { JobCard } from "~/debug/components/job-card";
import { call, job, view } from "./_fixtures";

const render = (v: ReturnType<typeof view>, expanded = true) =>
  renderToStaticMarkup(
    <JobCard
      view={v}
      expanded={expanded}
      onToggle={() => {}}
      onSelectSeq={() => {}}
    />,
  );

const finishedResult = {
  checkpoint: {
    beat: ["a1"],
    npcTurn: null,
    director: { plan: "x" },
    interpret: { i: 1 },
    adjudicate: { a: 1 },
    submissions: [
      {
        stepRef: "s1",
        key: "k1",
        kind: "attack",
        result: "applied",
        seqs: [3, 4],
      },
      {
        stepRef: "s2",
        key: "k2",
        kind: "move",
        result: "refused",
        refusal: { code: "out-of-range" },
        seqs: [],
      },
    ],
    narration: {
      attempts: [
        {
          words: 120,
          proseSha256: "abc123",
          deterministic: {
            issues: [{ kind: "length", detail: "long", blocking: true }],
          },
          llm: { issues: [{ kind: "tone", detail: "flat", blocking: false }] },
        },
      ],
      shipped: true,
      seqs: [5],
    },
  },
  outcome: { status: "completed" },
  audit: { final: "passed" },
  calls: [],
};

test("collapsed card shows summary fields and no sections", () => {
  const j = job({ result: finishedResult });
  const html = render(
    view(j, [
      call({}),
      call({ id: 2, costUsd: null, inputTokens: 4, outputTokens: 1 }),
    ]),
    false,
  );
  expect(html).toContain("turn");
  expect(html).toContain("commit");
  expect(html).toContain("succeeded");
  expect(html).toContain("shipped");
  expect(html).toContain("5 s");
  expect(html).toContain("attempts 1");
  expect(html).toContain("2 calls");
  expect(html).toContain("20 tokens");
  expect(html).toContain("unpriced");
  expect(html).not.toContain("Director");
});

test("expanded turn shows seven sections in order with not-run placeholders", () => {
  const html = render(
    view(
      job({
        status: "running",
        result: { checkpoint: { beat: ["a"], submissions: [] } },
      }),
    ),
  );
  const order = [
    "Assemble",
    "Director",
    "Interpret",
    "Adjudicate",
    "Resolve",
    "Narrate and check",
    "Failure",
  ];
  const at = order.map((n) => html.indexOf(`aria-label="${n}"`));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
  expect(html).toContain("not run");
});

test("resolve rows show refusal codes and seq links", () => {
  const html = render(view(job({ result: finishedResult })));
  expect(html).toContain("refused: out-of-range");
  expect(html).toContain('data-seq-link="3"');
  expect(html).toContain('data-seq-link="4"');
});

test("audit attempts list blocking and advisory apart with words and hash", () => {
  const html = render(view(job({ result: finishedResult })));
  expect(html).toContain("120 words");
  expect(html).toContain("abc123");
  expect(html).toContain("Blocking: length long");
  expect(html).toContain("Advisory: tone flat");
});

test("fallback flag shows", () => {
  const html = render(
    view(job({ result: { ...finishedResult, audit: { final: "fallback" } } })),
  );
  expect(html).toContain("Fallback narration shipped");
});

test("failure section shows excerpts", () => {
  const html = render(
    view(
      job({
        status: "failed",
        result: {
          failure: {
            node: "narrate-check",
            kind: "audit-failed",
            message: "bad",
            detail: {
              attempts: [
                {
                  attempt: 1,
                  chars: 40,
                  issues: "blocking",
                  excerpt: "EXCERPT-TEXT",
                },
              ],
            },
          },
        },
      }),
    ),
  );
  expect(html).toContain("audit-failed at narrate-check");
  expect(html).toContain("EXCERPT-TEXT");
});

test("a call without usage reads usage not recorded", () => {
  const html = render(
    view(
      job({
        result: {
          checkpoint: { beat: ["a"], director: {}, submissions: [] },
          calls: [{ purpose: "dm.director", attempt: 1, outcome: "ok" }],
        },
      }),
    ),
  );
  expect(html).toContain("usage not recorded");
});

test("companion card shows plays and submissions", () => {
  const html = render(
    view(
      job({
        kind: "companion",
        input: { reason: "beat" },
        result: {
          plays: [
            {
              companionId: "mira",
              submissions: [{ kind: "say", ok: true, seqs: [9] }],
            },
          ],
        },
      }),
    ),
  );
  expect(html).toContain("mira");
  expect(html).toContain("say");
  expect(html).toContain('data-seq-link="9"');
});

test("link unknown shows when linkUnknown", () => {
  const unknown = render(
    view(
      job({
        result: {
          checkpoint: {
            beat: [],
            submissions: [
              {
                stepRef: "s",
                key: "k",
                kind: "x",
                result: "applied",
                seqs: [],
              },
            ],
          },
        },
      }),
    ),
    false,
  );
  expect(unknown).toContain("link unknown");
  expect(render(view(job({ result: finishedResult })), false)).not.toContain(
    "link unknown",
  );
});
