import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FilterChips } from "~/play/components/filter-chips";

test("four buttons in a named group; exactly one is pressed", () => {
  const html = renderToStaticMarkup(
    <FilterChips value="rules" onChange={() => {}} />,
  );
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Filter the stream"');
  expect(html.match(/<button/g)).toHaveLength(4);
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
  expect(html).toMatch(/aria-pressed="true"[^>]*>Rules</);
});
