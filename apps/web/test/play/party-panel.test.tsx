import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PartyPanel } from "~/play/components/party-panel";
import type { PartyRow } from "~/play/party";

const row = (over: Partial<PartyRow>): PartyRow => ({
  characterId: "a",
  name: "Ana",
  controller: "You",
  isAi: false,
  isOwn: false,
  classLevel: "Fighter 3",
  hp: { current: 20, max: 28, temp: 0 },
  ac: 16,
  ...over,
});

test("empty party", () => {
  expect(renderToStaticMarkup(<PartyPanel rows={[]} order={[]} />)).toContain(
    "No party yet.",
  );
});

test("badge, AI label, vitals line and temp HP", () => {
  const html = renderToStaticMarkup(
    <PartyPanel
      rows={[
        row({ isOwn: true, hp: { current: 20, max: 28, temp: 3 } }),
        row({
          characterId: "o",
          name: "Odo",
          controller: "AI companion",
          isAi: true,
          classLevel: null,
          hp: null,
          ac: null,
        }),
      ]}
      order={[]}
    />,
  );
  expect(html).toContain("Your character");
  expect(html).toContain("AI companion");
  expect(html).toContain("Fighter 3 · HP 20/28 (+3) · AC 16");
  expect(html).toContain("Class and level not recorded · HP — · AC —");
  expect(html).toContain("data-own");
  expect(html).not.toContain("Initiative");
});

test("Initiative list only with a non-empty order", () => {
  const html = renderToStaticMarkup(
    <PartyPanel
      rows={[row({})]}
      order={[
        {
          combatantId: "x",
          label: "Ana",
          isActive: true,
          isNext: false,
          isViewer: true,
        },
      ]}
    />,
  );
  expect(html).toContain('aria-label="Initiative"');
  expect(html).toContain('aria-current="step"');
});
