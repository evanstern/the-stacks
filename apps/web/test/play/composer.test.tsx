import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Composer } from "~/play/components/composer";

const noop = () => true;
const base = {
  onTalk: noop,
  onDeclare: noop,
  disabled: false,
  notice: null,
};
const withCharacters = {
  characters: [{ characterId: "ana", label: "Ana" }],
  actionAvailable: true,
  actionHint: null,
};
const without = {
  characters: [],
  actionAvailable: false,
  actionHint:
    "You control no party character, so you cannot declare an action.",
};
const render = (c: typeof without, extra: object = {}) =>
  renderToStaticMarkup(<Composer composer={c} {...base} {...extra} />);

test("Talk shows the message type and Channel groups and a Send button", () => {
  const html = render(withCharacters);
  expect(html).toContain('aria-label="Message type"');
  expect(html).toContain("Talk");
  expect(html).toContain("Action");
  expect(html).toContain('aria-label="Channel"');
  expect(html).not.toContain('aria-label="Scope"');
  expect(html).toContain(">Send<");
});

test("Action shows the character choice, the Scope group and a Declare button", () => {
  const html = render(withCharacters, { initialType: "action" });
  expect(html).toContain('aria-label="Scope"');
  expect(html).toContain('aria-label="Character"');
  expect(html).not.toContain('aria-label="Channel"');
  expect(html).toContain(">Declare<");
});

test("Action is disabled with a hint when no action is available", () => {
  const html = render(without, { initialType: "action" });
  expect(html).toMatch(/<input[^>]*disabled=""[^>]*value="action"/);
  expect(html).toContain("cannot declare an action");
  expect(html).toContain(">Send<");
});

test("a refused request shows inline", () => {
  expect(render(withCharacters, { notice: "Not your turn" })).toContain(
    "Not your turn",
  );
});
