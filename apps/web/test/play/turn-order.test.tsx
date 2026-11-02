import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FloorControls } from "~/play/components/floor-controls";
import { TurnOrder } from "~/play/components/turn-order";
import type {
  FloorControls as FloorControlsView,
  OrderEntry,
} from "~/play/view-model";

const entry = (over: Partial<OrderEntry>): OrderEntry => ({
  combatantId: "x",
  label: "X",
  isActive: false,
  isNext: false,
  isViewer: false,
  ...over,
});

test("one entry per combatant, with active, next and you flags", () => {
  const html = renderToStaticMarkup(
    <TurnOrder
      order={[
        entry({
          combatantId: "ana",
          label: "Ana",
          isActive: true,
          isViewer: true,
        }),
        entry({ combatantId: "bram", label: "Bram", isNext: true }),
        entry({ combatantId: "goblin", label: "Goblin" }),
      ]}
    />,
  );
  expect(html.match(/<li/g)).toHaveLength(3);
  expect(html).toContain("Ana");
  expect(html).toContain(">you<");
  expect(html).toContain(">next<");
  expect(html).toContain('aria-current="step"');
  expect(html).toContain("flex-wrap");
  expect(html).not.toContain("<button");
});

test("an empty order renders nothing", () => {
  expect(renderToStaticMarkup(<TurnOrder order={[]} />)).toBe("");
});

// ---- floor controls: a click sends one `floor` request with the current turn ----

type Props = { onClick?: () => void; children?: ReactNode };

function buttons(
  node: ReactNode,
  out: { text: string; click: () => void }[] = [],
) {
  if (Array.isArray(node)) {
    for (const n of node) buttons(n, out);
  } else if (node && typeof node === "object" && "props" in node) {
    const el = node as ReactElement<Props>;
    if (el.type === "button" && el.props.onClick) {
      out.push({ text: String(el.props.children), click: el.props.onClick });
    }
    buttons(el.props.children, out);
  }
  return out;
}

const turn = { round: 2, combatantId: "ana" };
const controls = (over: Partial<FloorControlsView>): FloorControlsView => ({
  endTurn: false,
  pass: false,
  take: false,
  return: false,
  turn,
  ...over,
});

test("End turn sends one floor request carrying the current turn", () => {
  const sent: unknown[] = [];
  const el = FloorControls({
    controls: controls({ endTurn: true }),
    onFloor: (input) => {
      sent.push(input);
      return true;
    },
  });
  const found = buttons(el);
  expect(found.map((b) => b.text)).toEqual(["End turn"]);
  found[0].click();
  expect(sent).toEqual([{ op: "end", turn }]);
});

test("DM controls send end, take and return", () => {
  const sent: { op: string }[] = [];
  const onFloor = (input: { op: string }) => {
    sent.push(input);
    return true;
  };
  for (const c of [
    controls({ pass: true, take: true }),
    controls({ pass: true, return: true }),
  ]) {
    for (const b of buttons(FloorControls({ controls: c, onFloor }))) b.click();
  }
  expect(sent.map((s) => s.op)).toEqual(["end", "take", "end", "return"]);
});

test("no controls and no turn render nothing", () => {
  expect(
    FloorControls({ controls: controls({}), onFloor: () => true }),
  ).toBeNull();
  expect(
    FloorControls({
      controls: controls({ endTurn: true, turn: null }),
      onFloor: () => true,
    }),
  ).toBeNull();
});

test("the label prop sets the aria-label", () => {
  const o = [entry({ combatantId: "a", label: "A" })];
  expect(renderToStaticMarkup(<TurnOrder order={o} />)).toContain(
    'aria-label="Turn order"',
  );
  expect(
    renderToStaticMarkup(<TurnOrder order={o} label="Initiative" />),
  ).toContain('aria-label="Initiative"');
});
