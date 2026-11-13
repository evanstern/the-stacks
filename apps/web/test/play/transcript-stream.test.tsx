import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Transcript } from "~/play/components/transcript";
import type { TranscriptItem } from "~/play/view-model";

const commands = {
  commit: () => {},
  withdraw: () => {},
  accept: () => {},
  suggest: () => {},
  sendIntent: () => {},
} as never;
const render = (items: TranscriptItem[]) =>
  renderToStaticMarkup(
    <Transcript items={items} commands={commands} onNotQuite={() => {}} />,
  );

const streaming: TranscriptItem = {
  kind: "narration-stream",
  seq: 3,
  rows: "Check: 15 vs DC 12.",
  prose: "The shutter gives.",
};

test("the streaming block renders rows, prose, a text label and polite live-region attributes", () => {
  const html = render([streaming]);
  expect(html).toContain("The DM is narrating");
  expect(html).toContain("Check: 15 vs DC 12.");
  expect(html).toContain("The shutter gives.");
  expect(html).toContain('aria-live="polite"');
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
