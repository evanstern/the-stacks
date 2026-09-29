# Quickstart: D&D Beyond export parser (spec 012)

## Run the committed suite

```bash
pnpm --filter @the-stacks/server test -- library/ddb
```

Expected: all fixture tests pass; one line reads
`ddb real-export suite SKIPPED: put D&D Beyond export pages in fixtures/private/ddb/ to run it`.

## Run against your own export (never committed)

1. Save each book page from D&D Beyond in your browser as "Webpage, HTML only".
2. Put the files in `fixtures/private/ddb/` at the repo root, named so they sort in reading
   order (`01-intro.html`, `02-chapter-1.html`, …).
3. `git status` shows nothing new (the folder is ignored).
4. Run the command above. The real-export suite now runs and reports its invariant checks.

## Try it by hand

```bash
cd apps/server
node --experimental-strip-types -e '
import { readFileSync } from "node:fs";
import { parseDdbExport } from "./src/library/ddb/index.ts";
const html = readFileSync("test/fixtures/ddb/bestiary.html", "utf8");
const book = parseDdbExport({ book: "SRD Bestiary", pages: [html] });
console.log(book.blocks.map(b => `${b.kind}  ${b.path.join(" > ")}`).join("\n"));
'
```
