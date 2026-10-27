import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ModeBadge } from "~/play/components/mode-badge";

test("free mode", () => {
  expect(renderToStaticMarkup(<ModeBadge mode={{ mode: "free" }} />)).toContain(
    "Free mode",
  );
});

test("turn mode names the active player", () => {
  const html = renderToStaticMarkup(
    <ModeBadge
      mode={{
        mode: "turn",
        activeActor: "u1",
        activeLabel: "Ana",
        isViewersTurn: false,
        held: false,
        order: [],
      }}
    />,
  );
  expect(html).toContain("Turn mode · Ana&#x27;s turn");
});

test("turn mode on the viewer's turn", () => {
  const html = renderToStaticMarkup(
    <ModeBadge
      mode={{
        mode: "turn",
        activeActor: "u1",
        activeLabel: "Ana",
        isViewersTurn: true,
        held: false,
        order: [],
      }}
    />,
  );
  expect(html).toContain("Turn mode · Your turn");
});

test("turn mode names the DM while the DM holds the floor", () => {
  const html = renderToStaticMarkup(
    <ModeBadge
      mode={{
        mode: "turn",
        activeActor: "dm-user",
        activeLabel: "dm-user",
        isViewersTurn: false,
        held: true,
        order: [],
      }}
    />,
  );
  expect(html).toContain("Turn mode · The DM has the floor");
  expect(html).not.toContain("dm-user");
});
