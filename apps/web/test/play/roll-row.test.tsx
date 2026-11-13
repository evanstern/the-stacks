import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RollRow } from "~/play/components/roll-row";

const roll = {
  seq: 1,
  category: "rules",
  pinned: false,
  kind: "roll",
  summary: "Ana — Stealth with advantage 18 ✓ success",
  detail: ["d20: 18, 6 (dropped) + 2 = 20 vs DC 12", "Ana succeeds."],
  dice: [{ sides: 20, faces: [18, 6], kept: [true, false] }],
  total: 20,
} as never;

test("a roll row is details/summary with the dropped face struck and named", () => {
  const html = renderToStaticMarkup(<RollRow roll={roll} />);
  expect(html).toContain("<details");
  expect(html).toContain("<summary");
  expect(html).toContain("✓ success");
  expect(html).toContain('<s>6<span class="sr-only">, dropped</span></s>');
  expect(html.match(/, dropped/g)).toHaveLength(1);
});

test("a roll row opens from the keyboard: it is a native summary (focusable, Enter and Space toggle)", () => {
  const html = renderToStaticMarkup(<RollRow roll={roll} />);
  expect(html).not.toMatch(/tabindex="-1"/);
  expect(html).not.toContain("<details open");
});
