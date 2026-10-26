import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

test("vitest renders TSX markup", () => {
  expect(renderToStaticMarkup(<p>ok</p>)).toBe("<p>ok</p>");
});
