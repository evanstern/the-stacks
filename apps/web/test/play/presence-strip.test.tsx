import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PresenceStrip } from "~/play/components/presence-strip";
import type { PresenceRow } from "~/play/presence";

const rows: PresenceRow[] = [
  { key: "ai:dm", label: "AI DM", role: "dm", present: true },
  { key: "u1", label: "Ana", role: "player", present: true },
  { key: "u2", label: "Ben", role: "observer", present: true },
  { key: "u3", label: "Dana", role: "dm", present: false },
];

test("each row shows its name and role, absent rows say so", () => {
  const html = renderToStaticMarkup(<PresenceStrip rows={rows} />);
  expect(html).toContain("AI DM");
  expect(html).toContain("Player");
  expect(html).toContain("Observer");
  expect(html).toContain("DM · absent");
  expect(html).toContain('data-presence="absent"');
});

test("no rows render nothing, and the markup has no modal", () => {
  expect(renderToStaticMarkup(<PresenceStrip rows={[]} />)).toBe("");
  expect(renderToStaticMarkup(<PresenceStrip rows={rows} />)).not.toMatch(
    /dialog|modal/i,
  );
});
