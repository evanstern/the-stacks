import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { EventLog } from "~/debug/components/event-log";
import { ev } from "./_fixtures";

const events = [
  ev(1, "action.committed", "u1", "all"),
  ev(2, "narration", "dm", "all"),
  ev(3, "note", "dm", "dm"),
];
const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <EventLog
      events={events}
      actorName={(a) => (a === "dm" ? "DM" : a)}
      highlightSeqs={new Set()}
      selectedSeq={null}
      onSelectSeq={() => {}}
      {...over}
    />,
  );

test("each row shows seq, time, actor name, type, visibility, collapsed payload", () => {
  const html = render();
  expect(html).toContain("#2");
  expect(html).toContain("12:00:02");
  expect(html).toContain("DM");
  expect(html).toContain("narration");
  expect(html).toContain(">dm<");
  expect(html).toContain("<details>");
  expect(html).not.toContain("<details open");
});

test("type combobox has ARIA wiring and a listbox of matching options", () => {
  const html = render();
  expect(html).toContain('role="combobox"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toMatch(/aria-controls="([^"]+)"/);
  const id = /aria-controls="([^"]+)"/.exec(html)?.[1];
  expect(html).toContain(`id="${id}"`);
  expect(html).toContain('role="listbox"');
  expect(html).toContain('role="option"');
  expect(html).toContain("action.committed");
});

test("chosen filters narrow the rows", () => {
  const html = render({
    initialFilter: { types: ["narration"], actors: [], visibilities: [] },
  });
  expect(html).toContain('data-seq="2"');
  expect(html).not.toContain('data-seq="1"');
  expect(html).not.toContain('data-seq="3"');
});

test("rows in the highlighted set carry the highlight marker", () => {
  const html = render({ highlightSeqs: new Set([2]) });
  expect(html).toMatch(/data-seq="2" data-highlight="true"/);
  expect(html).not.toMatch(/data-seq="1" data-highlight/);
});

test("show 500 older appears past 500 rows", () => {
  const many = Array.from({ length: 501 }, (_, i) => ev(i + 1));
  const html = render({ events: many });
  expect(html).toContain("Show 1 older");
  expect(html).not.toContain('data-seq="1"');
  expect(html).toContain('data-seq="501"');
  expect(render()).not.toContain("Show ");
});
