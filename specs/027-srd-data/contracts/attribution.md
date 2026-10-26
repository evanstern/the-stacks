# Contract: attribution (AC #2, AC #6)

Normative.

## The one source in code

`packages/srd/src/attribution.ts`, exported as subpath `@the-stacks/srd/attribution`
(package.json `exports`). It imports nothing, so the web bundle gets no SRD data.

```ts
/** Exact statement from SRD 5.2.1 p.1 "Legal Information". Do not edit. */
export const SRD_ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

/** CC-BY-4.0 §3(a)(1)(B) change notice. Not attribution to Wizards. */
export const SRD_CHANGE_NOTICE: string;

/** Upstream dataset credit, or null if the records were transcribed from the PDF directly. */
export const SRD_DATA_SOURCE: { name: string; url: string; commit: string; license: string } | null;
```

The string uses U+201C and U+201D around `SRD 5.2.1`. The test compares code points.

## The attribution file

`packages/srd/ATTRIBUTION.md`, shipped with the package and copied into the runtime image
with `packages/srd/data`. Content, in order:

1. The exact statement, on its own paragraph, byte-identical to `SRD_ATTRIBUTION`.
2. The change notice: the records restructure SRD 5.2.1 text into data records for
   the-stacks; the restructuring is not endorsed by the licensor.
3. The data source line (`SRD_DATA_SOURCE`), when there is one.
4. Nothing else about Wizards: no trademark lines, no logo credits, no "D&D is a trademark"
   sentence. The SRD's legal page asks for no other attribution.

## The About page

- Route `/about` (`apps/web/app/routes/about.tsx`), rendered inside the app shell for every
  signed-in role. Linked from the shell footer as "About", next to Settings.
- Shows `SRD_ATTRIBUTION` verbatim in a block of its own, the change notice, and the data
  source. It may say the app is "5E compatible".
- It is a route. No `<dialog>`, `showModal`, `AlertDialog`, or Sheet-as-modal.

## Tests

| Test | Fails when |
|---|---|
| `packages/srd/test/attribution.test.ts` | `ATTRIBUTION.md` is missing; it does not contain `SRD_ATTRIBUTION` exactly; `SRD_ATTRIBUTION` differs from the golden string in the test (a second copy, deliberately, so an edit to the constant also fails); the file mentions "Wizards" anywhere outside the statement. |
| `packages/srd/test/source-ref.test.ts` | Any shipped record lacks `source`, or its `document` is not `SRD 5.2.1`, or its page is outside its kind's range. |
| `apps/web/test/ssr.test.mjs` (new case) | The SSR HTML of `/about` for a signed-in user does not contain the statement (HTML-escaped as React renders it). |
| `apps/web/test/no-dialog.test.mjs` (existing) | The About page uses a modal primitive. |

The golden string in `attribution.test.ts` is the one permitted duplicate. It is the test's
oracle, not a second display source.
