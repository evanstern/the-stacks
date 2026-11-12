import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Composer } from "~/play/components/composer";
import type { ComposerView } from "~/play/view-model";

const yes = () => true;
const commands = {
  sendIntent: yes,
  sendTalk: yes,
  declareAction: yes,
  commit: yes,
};
const player: ComposerView = {
  speakers: [
    { id: "ana", label: "Ana", ooc: false },
    { id: null, label: "You (out of character)", ooc: true },
  ],
  mentions: [
    { token: "@dm", label: "DM", targetId: null },
    { token: "@ana", label: "Ana", targetId: "ana" },
  ],
  mode: "free",
  active: false,
  dm: false,
  canSend: true,
  hint: null,
};
const render = (c: ComposerView, extra: object = {}) =>
  renderToStaticMarkup(
    <Composer
      composer={c}
      commands={commands}
      disabled={false}
      notice={null}
      {...extra}
    />,
  );

test("one composer, one Send, a Speaker chip, no old controls (SC-005)", () => {
  const html = render(player);
  expect(html.match(/type="submit"/g)?.length).toBe(1);
  expect(html).toContain(">Send<");
  expect(html).toContain('aria-label="Speaker"');
  for (const name of [
    "Message type",
    "Scope",
    "Declare",
    "Approve",
    "Object",
    "Commit",
    "Comment on this action",
    "The party",
  ]) {
    expect(html, name).not.toContain(name);
  }
  expect(html).not.toContain('role="dialog"');
});

test("the speaker chip names the first character", () => {
  expect(render(player)).toContain(">Ana<");
});

test("the active player sees one hint tied to the input by aria-describedby", () => {
  const html = render({ ...player, mode: "turn", active: true });
  expect(html).toContain("Enter commits your turn");
  expect(html).toContain('aria-describedby="composer-hint"');
  expect(html).toContain('id="composer-hint"');
  expect(render(player)).not.toContain("Enter commits your turn");
});

test("Thinking with a character speaker reads Send — interrupts the DM", () => {
  expect(render(player, { thinking: true })).toContain(
    "Send — interrupts the DM",
  );
  expect(render({ ...player, mode: "turn" }, { thinking: true })).not.toContain(
    "interrupts",
  );
});

test("a viewer who cannot send gets a disabled Send and the hint", () => {
  const html = render({
    ...player,
    canSend: false,
    hint: "You control no party character, so you cannot send a line.",
  });
  expect(html).toMatch(
    /<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/,
  );
  expect(html).toContain("cannot send a line");
});

test("a refused request shows inline", () => {
  expect(render(player, { notice: "Not your turn" })).toContain(
    "Not your turn",
  );
});
