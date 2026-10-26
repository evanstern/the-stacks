import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(pkgDir, "src");

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSources(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const files = listSources(srcDir);

function specifiers(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) found.push(m[1] as string);
  }
  return found;
}

describe("engine purity", () => {
  it("scans at least one source file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("imports only zod or relative modules", () => {
    for (const file of files) {
      for (const spec of specifiers(readFileSync(file, "utf8"))) {
        const ok =
          spec === "zod" || spec.startsWith("./") || spec.startsWith("../");
        expect(ok, `${path.relative(pkgDir, file)} imports "${spec}"`).toBe(
          true,
        );
      }
    }
  });

  it("uses no clock, global randomness or dynamic code", () => {
    const banned: [string, RegExp][] = [
      ["Math.random", /\bMath\s*\.\s*random\b/],
      ["Date", /\bDate\b/],
      ["globalThis", /\bglobalThis\b/],
      ["new Function", /\bnew\s+Function\b/],
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const [name, re] of banned) {
        expect(
          re.test(source),
          `${path.relative(pkgDir, file)} uses ${name}`,
        ).toBe(false);
      }
    }
  });

  it("declares zod as the only dependency", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(pkgDir, "package.json"), "utf8"),
    );
    expect(Object.keys(pkg.dependencies)).toEqual(["zod"]);
  });
});
