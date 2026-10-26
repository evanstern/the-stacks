# Quickstart: validate the SRD 5.2.1 baseline (TASK-0043)

Run every step from `/Users/evanstern/projects/the-stacks/.worktrees/task-0043`. No database
is needed.

## 1. Install and build

```sh
pnpm install
pnpm --filter @the-stacks/srd build
```

Expected: `packages/srd/dist/` exists. No new third-party package appears in
`pnpm-lock.yaml` beyond workspace links.

## 2. Package tests (AC #1, #4, #5, #6, #7)

```sh
pnpm --filter @the-stacks/srd test
```

Expected: all green. The compact test prints per-kind median and maximum estimated tokens;
every maximum is at or under 120. Record the printed numbers in the PR description.

## 3. Lookups by hand (AC #4, #5)

```sh
node -e '
const s = await import("./packages/srd/dist/index.js");
console.log(s.getById("monster", "goblin-warrior")?.ac);
console.log(s.getByName("spell", "FIRE  bolt")?.level);
console.log(s.getByName("equipment", "longsword")?.damage);
console.log(s.compact("condition", "prone"));
console.log(s.getByName("monster", "beholder"));
' --input-type=module
```

Expected: `15`; `0`; `{ dice: "1d8", type: "Slashing" }`; a short Prone block ending in
`SRD 5.2.1 p.<page>`; `undefined` (Beholder is not in SRD 5.2.1).

## 4. Attribution guard (AC #2, #6)

```sh
mv packages/srd/ATTRIBUTION.md /tmp/attr.bak
pnpm --filter @the-stacks/srd test -- attribution   # expect FAIL
mv /tmp/attr.bak packages/srd/ATTRIBUTION.md
pnpm --filter @the-stacks/srd test -- attribution   # expect PASS
```

## 5. About page (AC #2)

```sh
pnpm --filter @the-stacks/web build
pnpm --filter @the-stacks/web test
```

Expected: the new `/about` SSR case and `no-dialog` pass. Then start the app in this worktree
(`pnpm env:up`, `pnpm dev`), sign in, click **About** in the shell footer, and confirm the
statement appears exactly. Take the screenshot in **Brave** and attach it to the PR. Run
`pnpm env:down` afterwards.

## 6. Provenance (AC #7)

```sh
jq '.pdfSha256' packages/srd/provenance/srd-5.2.1-index.json
jq '[.records[] | select(.ok == false)] | length' packages/srd/provenance/verification.json
```

Expected: `"8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87"` and `0`.
A reviewer with the PDF can rerun
`node packages/srd/scripts/verify-against-pdf.mjs <path-to-SRD_CC_v5.2.1.pdf>` and get no diff.

## 7. Full gate

```sh
pnpm ci:check
```

Expected: green, including `check:boundaries` with the new `packages/srd` fixture flagged.
