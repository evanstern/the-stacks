import assert from "node:assert/strict";
import { test } from "node:test";
import { narrationRows } from "../../app/play/narration-rows.ts";

const block = [
  "Ana: 1d20+4 → 14 = 18 vs AC 12: hit",
  "Goblin takes 5 slashing (7→2 HP)",
  "Rule: Hide uses Dexterity (Stealth)",
  "Ana: refused, no such target (NO_TARGET)",
  "State: Ana HP 9/9; Goblin HP 2/7",
].join("\n");

test("a block of dice and change lines is dropped; why, refusal and State lines are kept", () => {
  const { prose, rules } = narrationRows(`The blade bites.\n\n${block}`);
  assert.deepEqual(prose, [{ kind: "prose", text: "The blade bites." }]);
  assert.deepEqual(rules, [
    "Rule: Hide uses Dexterity (Stealth)",
    "Ana: refused, no such target (NO_TARGET)",
    "State: Ana HP 9/9; Goblin HP 2/7",
  ]);
});

test("straight and curly quotes make dialogue segments, in source order", () => {
  const { prose } = narrationRows(
    'The door opens. "Halt," says Wenna. She waits. “Who goes?” she adds.',
  );
  assert.deepEqual(
    prose.map((s) => s.kind),
    ["prose", "dialogue", "prose", "dialogue", "prose"],
  );
  assert.equal(prose[1].text, '"Halt," says Wenna.');
});

test("text with no code block renders whole", () => {
  const text = "One paragraph.\n\nAnother paragraph, no rows.";
  const { prose, rules } = narrationRows(text);
  assert.equal(
    prose.map((s) => s.text).join(" "),
    "One paragraph. Another paragraph, no rows.",
  );
  assert.deepEqual(rules, []);
});

test("an echoed declaration's dialogue row has no stray period after the closing quote", () => {
  const { prose } = narrationRows(
    'Tamsin Vale means to: "I search the ferry-house for whoever cut the bell rope.".',
  );
  assert.equal(
    prose[0].text,
    'Tamsin Vale means to: "I search the ferry-house for whoever cut the bell rope."',
  );
});

test("a Deed line stays in the rules", () => {
  const { prose, rules } = narrationRows(
    "The door gives.\n\nDeed: Ana: /search #ferry-house\nState: Anyone may act.",
  );
  assert.deepEqual(prose, [{ kind: "prose", text: "The door gives." }]);
  assert.deepEqual(rules, [
    "Deed: Ana: /search #ferry-house",
    "State: Anyone may act.",
  ]);
});
