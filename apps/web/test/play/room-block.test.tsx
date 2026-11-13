import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RoomBlock } from "~/play/components/room-block";

const room = (ways: { label: string; draft: string }[]) =>
  ({
    seq: 1,
    category: "ic",
    pinned: false,
    kind: "room",
    heading: "Undercroft",
    description: "Damp stone.",
    ways,
    party: "Party: Ana HP 9/9 AC 14",
  }) as never;

test("a room block shows heading, description, ways as plain text and the party", () => {
  const html = renderToStaticMarkup(
    <RoomBlock
      room={room([
        { label: "North door", draft: "/move" },
        { label: "Stairs", draft: "x" },
      ])}
    />,
  );
  expect(html).toContain("<h3");
  expect(html).toContain("Undercroft");
  expect(html).toContain("Damp stone.");
  expect(html).toContain("Ways on: North door, Stairs");
  expect(html).not.toContain("<button");
  expect(html).toContain("Party: Ana HP 9/9 AC 14");
});

test("no Ways on line when ways is empty", () => {
  expect(renderToStaticMarkup(<RoomBlock room={room([])} />)).not.toContain(
    "Ways on",
  );
});
