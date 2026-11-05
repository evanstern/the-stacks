import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StatusStrip } from "~/play/components/status-strip";
import type { PartyRow } from "~/play/party";
import type { ModeView } from "~/play/view-model";

const own: PartyRow = {
  characterId: "k",
  name: "Kestrel",
  controller: "You",
  isAi: false,
  isOwn: true,
  classLevel: "Rogue 1",
  hp: { current: 9, max: 9, temp: 0 },
  ac: 14,
};
const turn: ModeView = {
  mode: "turn",
  activeActor: "u",
  activeLabel: "Kestrel",
  isViewersTurn: true,
  held: false,
  order: [],
};

test("free play", () => {
  const html = renderToStaticMarkup(
    <StatusStrip own={own} conditions={[]} mode={{ mode: "free" }} />,
  );
  expect(html).toContain(
    "Kestrel · HP 9/9 · AC 14 · Conditions: none · Turn: free play",
  );
});

test("own turn and a condition", () => {
  const html = renderToStaticMarkup(
    <StatusStrip own={own} conditions={[{ condition: "prone" }]} mode={turn} />,
  );
  expect(html).toContain("Conditions: prone · Turn: Kestrel (you)");
});

test("no character shows only the turn", () => {
  const html = renderToStaticMarkup(
    <StatusStrip own={null} conditions={[]} mode={{ mode: "free" }} />,
  );
  expect(html).toContain(">Turn: free play<");
  expect(html).not.toContain("HP");
});
