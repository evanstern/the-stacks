# Contract: compact lookup form and its size bound (AC #5)

Normative. `packages/srd/src/compact.ts` and `packages/srd/src/tokens.ts`.

## The bound

- **Target**: about 100 estimated tokens per record.
- **Hard ceiling**: 120 estimated tokens. Every shipped record's compact form MUST be at or
  under it. The test fails on the first record over, naming its kind, id and size.
- **No median assertion.** Monster forms run near the ceiling by design (they fill to it,
  then truncate), so a median rule would fight the truncation rule. The test prints the
  per-kind median and maximum, and the PR records them.
- The bound is defined by `estimateTokens`, below. It is not defined by any model's
  tokenizer.

## The estimator

```ts
/** Deterministic token estimate. Standard library only; no model, network, or vendor tokenizer. */
export function estimateTokens(text: string): number;
```

Rule:

1. Match `text` against `/[A-Za-z]+|[0-9]+|[^\sA-Za-z0-9]/g`.
2. A letter run of length L adds `Math.ceil(L / 5)`.
3. A digit run of length L adds `Math.ceil(L / 3)`.
4. Any other matched character adds 1.
5. Whitespace adds nothing.

Golden values (the test pins these exactly):

| Input | Estimate |
|---|---|
| `""` | 0 |
| `"Goblin Warrior"` | 4 (`Goblin` 2, `Warrior` 2) |
| `"AC 15, HP 10 (3d6)"` | 10 (`AC`, `15`, `,`, `HP`, `10`, `(`, `3`, `d`, `6`, `)`: 1 each) |
| `"Slashing"` | 2 |
| `"1234567"` | 3 |

A change to the rule is a reviewed diff to this table and the test together.

Rationale and rejected alternatives: `../research.md` R5.

## The renderer

```ts
/** Pure: same record in, same string out. No I/O. */
export function toCompact<K extends SrdKind>(kind: K, record: SrdRecord<K>): string;
```

Shape: plain text, one short line per part, no Markdown. Every form starts with
`<Name> [<kind>/<id>]` and ends with `SRD 5.2.1 p.<page>`. Words are kept terse because
every punctuation mark and sign costs an estimated token. Abbreviations are fixed: AC, HP,
Spd, CR, Str/Dex/Con/Int/Wis/Cha, adv (Advantage), DC, ft.

### Per kind

- **monster**: `<Name> [monster/<id>] <size> <type>, <alignment abbreviation>`;
  `AC <ac> HP <avg> (<formula>) Spd <walk>[ fly <n>…] CR <rating>`; ability modifiers only
  (`Str-1 Dex+2 …`); then actions in SRD order as
  `<Name> +<bonus> <reach>ft|<normal>/<long> <dice> <type>[ (+<dice> if <short condition>)]`,
  or `<Name> DC <dc> <Ability>`, or `<Name>` alone; then trait names only. When the next
  part would cross the ceiling, the renderer stops and appends `+<n> more`.
- **spell**: `<Name> [spell/<id>] <school> <cantrip|level N>[ ritual][ conc]`;
  `<casting time>; <range>; <V,S,M>; <duration>`; leading sentences of `text` that fit;
  `Upgrade:` or `Higher:` plus its first sentence when it fits.
- **class**: `<Name> [class/<id>] <hit die>; saves <a,b>; primary <ability>[; casts
  <ability>]`; `L1 <feature names>` through `L5`; `Subclass <name>`; then `+L6-20`.
- **equipment**: weapon `<Name> [equipment/<id>] <simple|martial> <melee|ranged> <dice>
  <type>; <properties>; mastery <name>; <cost>`; armor `<category>; AC <formula>[; Str
  <n>][; stealth disadv]; <cost>`; other categories `<category>; <cost>` plus the leading
  sentence of `text` that fits.
- **condition**: `<Name> [condition/<id>]`, then each effect as `<Effect name>: <text>`,
  cut to leading sentences when the whole would cross the ceiling.

### Feasibility check (measured with the rule above, 2026-10-25)

Hand-written forms in this shape measured 107 (Goblin Warrior, full), 73 (Fire Bolt) and 70
(Prone). A first draft with full ability scores, senses and languages measured 185 for the
Goblin Warrior, which is why the shape above keeps modifiers only and drops senses,
languages and proficiency bonus. Large stat blocks (dragons) always truncate; that is the
designed behavior, and the `+<n> more` tail plus the ref header point to the full record.

### Truncation rule

The renderer adds parts in order and never splits a part mid-word. It stops before the part
that would push the estimate over the ceiling minus the size of the `+<n> more` tail and the
footer, then appends both. The header already names the full record's ref, so the model can
ask for more.

## Tests that enforce this contract

1. `tokens.test.ts`: golden values; the estimator ignores whitespace; it is deterministic.
2. `compact.test.ts`: for every shipped record of every kind, `estimateTokens(toCompact(…))
   <= 120`; the test logs each kind's median and maximum; every form starts with `<Name> [<kind>/<id>]` and
   ends with `SRD 5.2.1 p.<page>`; `toCompact` called twice returns the same string.
3. One snapshot per kind (Goblin Warrior, Fire Bolt, Fighter, Longsword, Prone) pins the
   format, so format drift is a reviewed diff.
4. Every truncated form ends its body with `+<n> more` before the source footer.
