import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Margin } from "~/play/components/margin";
import { MiniStrip } from "~/play/components/mini-strip";
import type { PartyRow } from "~/play/party";
import type { ModeView, OrderEntry } from "~/play/view-model";

const row = (over: Partial<PartyRow>): PartyRow => ({
  characterId: "k",
  name: "Kestrel",
  controller: "You",
  isAi: false,
  isOwn: true,
  classLevel: "Rogue 1",
  hp: { current: 9, max: 9, temp: 0 },
  ac: 14,
  ...over,
});
const party = [
  row({}),
  row({
    characterId: "t",
    name: "Tamsin Vale",
    isOwn: false,
    hp: { current: 13, max: 13, temp: 0 },
  }),
  row({
    characterId: "o",
    name: "Brother Odo",
    isOwn: false,
    isAi: true,
    hp: { current: 10, max: 10, temp: 0 },
  }),
];
const entry = (over: Partial<OrderEntry>): OrderEntry => ({
  combatantId: "x",
  label: "X",
  isActive: false,
  isNext: false,
  isViewer: false,
  ...over,
});
const turn: ModeView = {
  mode: "turn",
  activeActor: "u",
  activeLabel: "Kestrel",
  isViewersTurn: true,
  held: false,
  order: [
    entry({
      combatantId: "k",
      label: "Kestrel",
      isActive: true,
      isViewer: true,
    }),
    entry({ combatantId: "s", label: "Snag", isNext: true }),
    entry({ combatantId: "t", label: "Tamsin" }),
    entry({ combatantId: "g", label: "Goblin" }),
  ],
};

test("free play: party vitals, not in combat, conditions none", () => {
  const html = renderToStaticMarkup(
    <Margin party={party} mode={{ mode: "free" }} conditions={[]} />,
  );
  expect(html).toContain('aria-label="Table state"');
  expect(html).toContain("Rogue 1 · HP 9/9 · AC 14");
  expect(html).toContain("Brother Odo");
  expect(html).toContain("Not in combat.");
  expect(html).toContain("Conditions: none.");
  expect(html).toContain("narrow:hidden");
});

test("turn mode: Turn order list with flags and conditions as words", () => {
  const html = renderToStaticMarkup(
    <Margin
      party={party}
      mode={turn}
      conditions={[{ name: "Snag", text: "prone, poisoned" }]}
    />,
  );
  expect(html).toContain('aria-label="Turn order"');
  expect(html).toContain('aria-current="step"');
  expect(html).toContain(">you<");
  expect(html).toContain(">next<");
  expect(html).toContain("Snag: prone, poisoned");
  expect(html).not.toContain("Not in combat.");
});

test("mini-strip: other members and the first three in order", () => {
  const html = renderToStaticMarkup(<MiniStrip party={party} mode={turn} />);
  expect(html).toContain(
    "Tamsin Vale 13/13 · Brother Odo 10/10 · Order: Kestrel › Snag › Tamsin…",
  );
  expect(html).toContain("narrow:block");
  expect(html).not.toContain("<ol");
});
