import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  DmSeatPanel,
  returnInput,
  seatInput,
} from "~/play/components/dm-seat-panel";
import type { DmSeatView } from "~/play/dm-seat";
import { dmSeatReason } from "~/play/frames";

const ai: DmSeatView = {
  holder: { kind: "ai" },
  candidates: [
    { userId: "u1", label: "Olive (you)" },
    { userId: "u2", label: "Bram" },
  ],
  canReturn: false,
  pendingCount: null,
};
const human: DmSeatView = {
  holder: { kind: "human", userId: "u1", label: "Olive" },
  candidates: [{ userId: "u2", label: "Bram" }],
  canReturn: true,
  pendingCount: 0,
};
const html = (view: DmSeatView) =>
  renderToStaticMarkup(<DmSeatPanel view={view} onSeat={() => true} />);

test("AI seat view", () => {
  const out = html(ai);
  expect(out).toContain("AI DM holds the seat.");
  expect(out).toContain("Seat a human DM");
  expect(out).toContain("Olive (you)");
  expect(out).toContain("Bram");
  expect(out).toMatch(/<button[^>]*disabled[^>]*>Seat as DM/);
  expect(out).not.toContain("Return the seat to the AI DM");
  expect(out).not.toContain('role="dialog"');
});

test("human seat view", () => {
  const out = html(human);
  expect(out).toContain("Olive holds the seat.");
  expect(out).toContain("Return the seat to the AI DM");
  expect(out).not.toContain("Pending proposals stay pending");
});

test("candidates null, empty", () => {
  const waiting = html({ ...ai, candidates: null });
  expect(waiting).toContain("Waiting for the people at the table.");
  expect(waiting).not.toContain("<select");
  expect(html({ ...ai, candidates: [] })).toContain(
    "No one else at the table can take the seat.",
  );
});

test("pending warning only with a human seat and a count", () => {
  expect(html({ ...human, pendingCount: 2 })).toContain(
    "Pending proposals stay pending under the AI DM: 2. Decide them first.",
  );
  expect(html({ ...human, pendingCount: null })).not.toContain(
    "Pending proposals stay pending",
  );
});

test("click helpers fill the default reason and trim", () => {
  expect(seatInput("u1", "")).toEqual({
    reason: dmSeatReason("seat"),
    after: { kind: "human", userId: "u1" },
  });
  expect(returnInput("  x  ")).toEqual({
    reason: "x",
    after: { kind: "ai" },
  });
  expect(returnInput("").reason).toBe(dmSeatReason("return"));
});
