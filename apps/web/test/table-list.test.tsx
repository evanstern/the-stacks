import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";
import { TableList } from "~/routes/table";

const A = "11111111-2222-3333-4444-555555555555";
const B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const render = (state: Parameters<typeof TableList>[0]["state"]) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <TableList state={state} />
    </MemoryRouter>,
  );

test("ready renders links in order with hrefs and titles", () => {
  const html = render({
    kind: "ready",
    tables: [
      {
        sessionId: A,
        title: "Ford",
        lastActivityAt: "2026-11-02T10:00:00.000Z",
        relation: "dm",
      },
      {
        sessionId: B,
        title: "Hollow",
        lastActivityAt: null,
        relation: "player",
      },
    ],
  });
  expect(html).toContain("Your tables");
  expect(html).toContain(`href="/play/${A}"`);
  expect(html).toContain(`href="/play/${B}"`);
  expect(html.indexOf(A)).toBeLessThan(html.indexOf(B));
  expect(html).toContain("Ford");
  expect(html).toContain("Hollow");
});

test("null title falls back to Untitled table and short id", () => {
  const html = render({
    kind: "ready",
    tables: [
      { sessionId: A, title: null, lastActivityAt: null, relation: "started" },
    ],
  });
  expect(html).toContain("Untitled table");
  expect(html).toContain("11111111");
});

test("relations render as DM, Player and Started", () => {
  const html = render({
    kind: "ready",
    tables: (["dm", "player", "started"] as const).map((relation, i) => ({
      sessionId: `0000000${i}-0000-0000-0000-000000000000`,
      title: "t",
      lastActivityAt: null,
      relation,
    })),
  });
  for (const label of ["DM", "Player", "Started"])
    expect(html).toContain(label);
});

test("lastActivityAt renders in a time element; null renders none", () => {
  const iso = "2026-11-02T10:00:00.000Z";
  const withTime = render({
    kind: "ready",
    tables: [{ sessionId: A, title: "t", lastActivityAt: iso, relation: "dm" }],
  });
  expect(withTime).toContain(`<time dateTime="${iso}"`);
  expect(withTime).toContain(new Date(iso).toLocaleString());
  const without = render({
    kind: "ready",
    tables: [
      { sessionId: A, title: "t", lastActivityAt: null, relation: "dm" },
    ],
  });
  expect(without).not.toContain("<time");
});

test("empty, error and loading states", () => {
  expect(render({ kind: "ready", tables: [] })).toContain("No tables yet.");
  const err = render({ kind: "error" });
  expect(err).toContain("Could not load your tables.");
  expect(err).toContain('role="alert"');
  expect(render({ kind: "loading" })).not.toContain("<li");
});

test("no markup contains dialog", () => {
  const html = render({
    kind: "ready",
    tables: [
      { sessionId: A, title: "t", lastActivityAt: null, relation: "dm" },
    ],
  });
  expect(html).not.toContain("dialog");
});
