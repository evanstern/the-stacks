import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Transcript } from "~/play/components/transcript";
import type { StreamItem } from "~/play/stream";
import type { TranscriptItem } from "~/play/view-model";

const commands = {
  commit: () => {},
  withdraw: () => {},
  accept: () => {},
  suggest: () => {},
  sendIntent: () => {},
} as never;
const wrap = (item: TranscriptItem): StreamItem => ({
  seq: item.seq,
  category: "ic",
  pinned: false,
  kind: "transcript",
  item,
});
const renderStream = (items: StreamItem[]) =>
  renderToStaticMarkup(
    <Transcript items={items} commands={commands} onNotQuite={() => {}} />,
  );
const render = (items: TranscriptItem[]) => renderStream(items.map(wrap));

const streaming: TranscriptItem = {
  kind: "narration-stream",
  seq: 3,
  rows: "Check: 15 vs DC 12.",
  prose: "The shutter gives.",
};

test("the streaming block renders rows, prose, a text label and aria-busy under the one polite log", () => {
  const html = render([streaming]);
  expect(html).toContain("The DM is narrating");
  expect(html).toContain("Check: 15 vs DC 12.");
  expect(html).toContain("The shutter gives.");
  // OQ-A14: the block keeps aria-busy; the log owns the one aria-live.
  expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
  expect(html).toContain('aria-busy="true"');
  // Rows come before prose.
  expect(html.indexOf("Check: 15")).toBeLessThan(
    html.indexOf("The shutter gives."),
  );
});

test("the settled narration row replaces the block (view-model drops the stream item)", () => {
  const html = render([
    { kind: "narration", seq: 3, text: "The shutter gives." },
  ]);
  expect(html).not.toContain("The DM is narrating");
  expect(html).toContain("The shutter gives.");
});

test("the block wraps at 390 px: break-words, no fixed width, no overflow-x", () => {
  const html = render([streaming]);
  expect(html).toContain("break-words");
  expect(html).not.toMatch(/\bw-\[|min-w-|whitespace-nowrap|overflow-x/);
});

test("one role=log named Table stream (TASK-0325, FR-011)", () => {
  const html = render([streaming]);
  expect(html.match(/role="log"/g)).toHaveLength(1);
  expect(html).toContain('aria-label="Table stream"');
});

test("order: roll and rules rows, then the streaming block, then settled narration; dice once; dialogue upright", () => {
  const html = renderStream([
    {
      seq: 1,
      category: "rules",
      pinned: false,
      kind: "roll",
      summary: "Ana — Stealth 18 ✓ success",
      detail: ["Total 18 vs DC 12"],
      dice: [{ sides: 20, faces: [18], kept: [true] }],
      total: 18,
    },
    {
      seq: 2,
      category: "rules",
      pinned: false,
      kind: "rules",
      text: "Ana is prone.",
    },
    wrap({
      kind: "narration-stream",
      seq: 3,
      rows: "",
      prose: "The shutter gives.",
    }),
    wrap({
      kind: "narration",
      seq: 4,
      text: 'The reeve says "Halt." He waits.',
    }),
  ]);
  const at = (s: string) => html.indexOf(s);
  expect(at("Stealth 18")).toBeLessThan(at("Ana is prone."));
  expect(at("Ana is prone.")).toBeLessThan(at("The DM is narrating"));
  expect(at("The DM is narrating")).toBeLessThan(at("The reeve says"));
  expect(html.match(/d20:/g)).toHaveLength(1);
  expect(html).toMatch(
    /data-kind="dialogue" class="whitespace-pre-line text-foreground">The reeve says/,
  );
  expect(html).toMatch(
    /class="whitespace-pre-line italic text-muted-foreground">He waits\./,
  );
});

test("a settled narration's rules lines render in the stream item, not inside the prose item", () => {
  const html = renderStream([
    wrap({ kind: "narration", seq: 1, text: "He waits.\n\nState: Ana HP 9/9" }),
  ]);
  expect(html).toContain("He waits.");
  expect(html).not.toContain("State: Ana");
});
