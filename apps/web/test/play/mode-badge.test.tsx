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
      }}
    />,
  );
  expect(html).toContain("Turn mode · Your turn");
});
