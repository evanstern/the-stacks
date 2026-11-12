import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ConfirmRow } from "~/play/components/confirm-row";
import type { ConfirmLine } from "~/play/view-model";

const line = (over: Partial<ConfirmLine> = {}): ConfirmLine => ({
  itemId: "i1",
  text: "Kestrel climbs the wall.",
  kindLabel: "Action",
  state: "live",
  canAccept: false,
  waitingOn: null,
  ...over,
});
const render = (l: ConfirmLine) =>
  renderToStaticMarkup(
    <ConfirmRow
      confirm={{ suggestionId: "sug-1", readSeq: 3, lines: [l] }}
      onAccept={() => true}
      onNotQuite={() => {}}
    />,
  );

test("the controller sees 👍 Yes and Not quite", () => {
  const html = render(line({ canAccept: true }));
  expect(html).toContain("👍 Yes");
  expect(html).toContain("Not quite");
  expect(html).toContain("Kestrel climbs the wall.");
  expect(html).toContain("Action");
});

test("another viewer sees Waiting on <name>, no buttons", () => {
  const html = render(line({ waitingOn: "Kestrel" }));
  expect(html).toContain("Waiting on Kestrel");
  expect(html).not.toContain("<button");
  expect(render(line({ waitingOn: "the party" }))).toContain(
    "Waiting on the party",
  );
});

test("a confirmed line reads Confirmed; a stale one reads Superseded", () => {
  const done = render(line({ state: "confirmed", canAccept: true }));
  expect(done).toContain("Confirmed");
  expect(done).not.toContain("<button");
  const stale = render(line({ state: "stale" }));
  expect(stale).toContain("Superseded");
  expect(stale).not.toContain("<button");
});
