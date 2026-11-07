# Table UX research: AI-DM and human-DM 5e play, text and VTT

**Phase:** Replan 2026-11, discovery. **Date:** 2026-11-06. **Tier:** opus (operator-authorized).
**Scope:** goal 3 in [brief.md](../brief.md). This covers talking to the DM, players and NPCs, combat, and text and VTT play.
**Inputs already ruled:** [chat-ui/decision.md](../../chat-ui/decision.md) (no modals, slide-out panel, Daylight), [mud-ux/decision.md](../../mud-ux/decision.md) (Margin layout, slide-out map, click-to-draft), decision-0028 one chat stream (via [decisions-digest.md](decisions-digest.md)).

Source caveat: many AI-DM reviews come from competitor blogs (DungeonsDeep, TableForge, StoryRoll, Arcanum). Each claim below names its source so it can be weighed.

---

## 1. Comparable products

| Product | What works | What frustrates | Lesson for us |
|---|---|---|---|
| **AI Dungeon** | Explicit input modes **Do / Say / Story / See**. Say wraps text in quotes ([help: Say mode](https://help.aidungeon.com/the-say-mode)). The command row has **Continue, Retry (retry stack), Erase, Undo/Redo** ([how to play](https://help.aidungeon.com/faq/how-to-play)). Story Cards are triggered by keywords, and a Context Viewer shows token cost ([settings](https://help.aidungeon.com/understanding-settings)). | No mechanics. Do/Say-only play gives repetitive "You…" prose (help docs, same page). Retry and Erase let players rewrite fate, which removes stakes. | The Do vs Say split is the oldest working answer to "talk vs act". Retry suits solo story play only. The engine's rolls are never retryable. |
| **Friends & Fables (Franz)** | **Working Context**: a drawer above the input that shows and edits what the DM will see next turn ([help](https://help.fables.gg/articles/8560008-working-context-blocks)). Reviewers praise it ([Arcanum](https://arcanumrpgs.com/blog/friends-and-fables-review/)). Hex battlemaps, dice and combat widgets, six-player multiplayer, voice commands. | Slow turns that "pulled us out of the scene" ([DungeonsDeep](https://dungeonsdeep.ai/blog/friends-and-fables-review-2026), competitor). A busy interface, plus a creature that was both dead and alive with no recovery ([DreamGen](https://dreamgen.com/blog/articles/friends-and-fables-review)). Turn order breaks in multi-faction scenes. Combat is **off by default** during a revamp ([GM settings](https://help.fables.gg/articles/6806457-gamemaster-settings)). The model decides state changes, not code ([TableForge](https://tableforge.gg/blog/friends-and-fables-vs-tableforge), competitor). | This confirms decision-0015 and decision-0017: the engine owns state. Show the DM's working context as a slide-out, since legibility earns trust. Latency is the top complaint. |
| **Hidden Door** | Cards for characters, places, objects and plot are the visible state. Choices are offered, and free text is allowed ([Bicking review](https://ianbicking.org/blog/2025/08/hidden-door-design-review-llm-driven-game)). Coherence is the best tested ([Arcanum](https://arcanumrpgs.com/blog/hidden-door-review/)). | Choices are near-duplicates or ignore the story. Typed text only regenerates the choices, which adds latency. Almost everything succeeds. Waits are long. Mechanics are weak (Bicking; Arcanum). | Suggested actions help only when they are grounded in state. Bicking's fix applies: stream the narration, then show choices. Fill waits with low-stakes inspect views. |
| **AI Realm** | Code resolves initiative, attacks and saves, then the model narrates ([Arcanum](https://arcanumrpgs.com/blog/ai-realm-review/)). It has an interactive sheet with animated dice, NPC Cards and Notes memory ([DungeonsDeep](https://dungeonsdeep.ai/blog/ai-realm-review-2026)). | Rules slip: the player rolled enemy damage, and a nat 1 was missed. There is no tactical map. Long campaigns degrade. | Our split matches it. Only the engine prompts rolls, and only for the right roller. |
| **Character.AI-style RP** | `(( ))` or `[OOC: ]` is the community out-of-character convention, and models understand it ([varen.chat](https://varen.chat/blog/ai-roleplay-formatting-ooc-asterisks)). | There is no official syntax, and bots begin adding OOC notes themselves ([RoboRhythms](https://www.roborhythms.com/character-ai-ooc-every-message/)). | Keep `((` as decision-0028 chose. Render OOC as a distinct row type, never as model-authored prose. |
| **Roll20** | Chat commands `/w name`, `/w gm`, `/em`, `/ooc`, `/gr`, inline `[[3d6+2]]`, and Tab-complete names ([help: Text Chat](https://help.roll20.net/hc/en-us/articles/360039675093-Text-Chat)). | The Turn Tracker has no round counter and Add Turn does not roll initiative ([help: Turn Tracker](https://help.roll20.net/hc/en-us/articles/360039178634-Turn-Tracker)). | The slash vocabulary is the de facto standard, so reuse its verbs. |
| **Foundry VTT (dnd5e)** | Chat styles IC / OOC / EMOTE / WHISPER / ROLL. `/ic` speaks as the selected token and shows a speech bubble on the map ([KB: chat](https://foundryvtt.com/article/chat/)). Roll cards have Attack/Damage/Apply buttons. midi-qol automates hit checks and damage ([midi-qol](https://github.com/tposney/midi-qol)). Measured templates handle AoE ([KB](https://foundryvtt.com/article/measurement/)). The advancement wizard handles level-up ([wiki](https://github.com/foundryvtt/dnd5e/wiki/Advancement-User-Guide)). | A basic attack takes 3–5 clicks across the sheet, the card and a dialog ([dnd5e #4459](https://github.com/foundryvtt/dnd5e/issues/4459)). Accessibility comes from third-party modules ([Foundry Navigator](https://foundryvtt.com/packages/foundry-navigator)). | One intent should produce one card. Attack and damage resolve together; never chain dialogs. Screen-reader parity is a differentiator. |
| **D&D Beyond sheet + Game Log + Maps** | Tap a number on the sheet to roll it, and the result posts to the shared Game Log ([guide](https://www.dndbeyond.com/posts/1003-how-to-customize-your-character-sheet-on-d-d)). Filters cover Actions / Bonus / Reactions. DM rolls can be secret ([Game Log](https://www.dndbeyond.com/posts/939-share-your-dice-results-with-the-brand-new-game)). The Maps initiative bar sits on top, and sheet HP syncs to the tracker ([DDB](https://www.dndbeyond.com/posts/1841-roll-for-initiative-combat-tracking-comes-to-the)). | Dice animation is slow and was once forced between rolls. Early Maps did not sync the sheet and the tracker ([Arcane Eye](https://arcaneeye.com/articles/dnd-beyonds-maps-vtt-gets-a-huge-upgrade-encounter-tracking/)). | The sheet is an action surface. The log is a projection of the same events. Keep animation optional and short. |
| **Avrae (Discord)** | Fully text-driven combat: `!init begin/join/next`, `!i a longsword -t "Goblin 1"`, `!init cast`, `!i hp` ([commands](https://avrae.io/commands/)). Links two-way with the DDB Game Log ([DDB support](https://dndbeyond-support.wizards.com/hc/en-us/articles/46385444116372-Game-Log)). | Arcane flag syntax (`-rr`, `-t`) and silent failures ("Avrae is typing…" then nothing). | This proves text combat can be complete. Keep the verb + target grammar, hide the flags behind autocomplete, and always answer. |
| **Owlbear Rodeo** | Deliberately minimal: a battlemap, not a full VTT. The initiative extension stores state on the token's metadata and adds context-menu items ([repo](https://github.com/owlbear-rodeo/initiative-tracker)). | Thin without extensions. | A small map surface plus context menus is enough. Our server holds the state, not the map. |
| **Alchemy RPG** | Scene-first: art, music, and a Story tab with text, plus a tactical view on demand ([StartPlaying](https://startplaying.games/blog/posts/alchemy-vtt-what-how-to)). | Critics call TotM a cover for missing features ([numtini](https://www.numtini.com/2025/01/14/alchemy-vtt-changing-gold-into-lead/)). | This validates the Margin decision: narrative first with a map on demand. The map must be good when it opens. |
| **MUD clients (Mudlet)** | Gauges, an automapper driven by GMCP, chat tabs and themes ([Mudlet](https://github.com/mudlet/mudlet)). Official packages give a HUD with zero scripting ([Icesus](https://icesus.org/guides/clients/mudlet-package/)). | Player-written triggers are a power-user tax. | Already digested in mud-ux/decision.md. Keep the HUD and the structured side channel; skip triggers. |
| **Baldur's Gate 3** (reference, not a web table) | Reactions are set per reaction to On / Off / **Ask**, and a prompt pauses play ([bg3.wiki](https://bg3.wiki/wiki/Reactions)). | Some reactions auto-fire by default and burn slots (same page). | Reaction policy is a per-character setting, and the safe default is Ask for anything that spends a resource. |

### Cross-cutting frustrations

1. **Latency.** Players complain at about 10 s per response and leave at 30 s or more ([itch.io thread](https://itch.io/post/7608462)). Multiplayer makes each wait worse. Our digest records a 28–39 s median AI turn (decision-0017 row). This is the biggest UX risk we have.
2. **State drift.** HP, the dead and turn order go wrong when the model owns them (F&F, AI Realm). We already avoid this by design.
3. **Click chains.** One intent spread across several surfaces (Foundry #4459).
4. **Illegible AI.** Players cannot tell why the DM ruled something. F&F's Working Context is the counter-example.

---

## 2. Communication

Six channels exist at a real table. Each must be one gesture away, and each needs its own row style.

| Channel | Who hears | Composer gesture | Row style |
|---|---|---|---|
| **In-character speech** | Everyone in the scene; NPCs react | Plain text (default under decision-0028) or `"…"` | Speaker portrait + quoted line |
| **Address an NPC** | Scene; that NPC answers | `@Mara …` (autocomplete from scene entities); click an NPC noun → "Talk to Mara" drafts `@Mara ` | Speech row with "→ Mara" tag |
| **Emote / deed** | Scene | `/me …` or `*…*`; or a draft from the sheet or map | Italic deed row, eligible for the DM confirm row |
| **Ask the DM (OOC, rules)** | DM only; read-only answer, no game-state change | `@dm …` (decision-0028) or `((…))` / `/ooc` | Muted OOC row, answer threaded under it |
| **Party chat (table talk)** | Players and the DM; NPCs never hear | `/p …` or a "Table talk" chip | Muted row, never fed to NPC voices |
| **Whisper** | One player, or the DM | `/w name …`, `/w dm …` ([Roll20](https://help.roll20.net/hc/en-us/articles/360039675093-Text-Chat) convention) | Locked row, visible only to its recipients (server-filtered, per the DM-only-text constraint) |

**Making it effortless:**
- The composer shows a **speaker/channel chip** to the left of the input (`Thorin ▸ scene`). Click it, or type `/`, to open the autocomplete dropdown of channels. No modal.
- `@` completes NPCs, PCs and `dm` from the current scene, the way [Roll20](https://help.roll20.net/hc/en-us/articles/360039675093-Text-Chat) Tab-completes names.
- A **"talking to" memory**: after `@Mara`, the chip stays on "→ Mara" until the scene changes or the player clears it. This saves retyping in long NPC conversations.
- Party chat must be a hard channel for the AI DM. Plans whispered as table talk must never leak into NPC knowledge. This is a server-side filter on what the narrator sees, not a prompt instruction.
- On the map, IC speech shows a speech bubble over the speaker's token, as [Foundry](https://foundryvtt.com/article/chat/) does. The stream keeps the text for screen-reader parity.

---

## 3. Actions

Three input surfaces exist. All three must produce **the same intent object** (section 7).

| Surface | Best for | Evidence |
|---|---|---|
| **Typed intent** ("I shove the goblin off the ledge") | Creative, non-mechanical, roleplay-heavy play; the AI DM's strength | AI Dungeon Do mode; decision-0028 |
| **Action bar / quick buttons** (Attack, Cast, Dash, Dodge, Help, Hide…) | Speed in combat; discoverability for new players | BG3 hotbar; [Token Action HUD](https://github.com/Larkinabout/fvtt-token-action-hud-dnd5e) |
| **Sheet click** (tap +5 Longsword, tap Fireball) | Known mechanics, skill checks | [D&D Beyond](https://www.dndbeyond.com/posts/1003-how-to-customize-your-character-sheet-on-d-d) |
| **Map click** (token → draft) | Targeting, movement | mud-ux/decision.md click-to-draft |

**Rules for every action:**
1. **Buttons and clicks draft; they never fire.** This matches the click-to-draft ruling. A sheet click drafts `/attack longsword @goblin-2`. The draft shows as a **pill** in the composer, not raw text, with editable slots (weapon, target, advantage). Enter sends it. This keeps one commit gesture across every surface.
2. **One intent, one card.** The roll card resolves attack, hit or miss against AC, and damage together, and applies the result in one row. This avoids the Foundry click chain ([#4459](https://github.com/foundryvtt/dnd5e/issues/4459)). The row is collapsed by default (`Thorin hits Goblin 2 — 11 slashing (dead)`) and expands inline to show the dice, the modifiers and the rule citation (mud-ux OQ3).
3. **Roll prompts belong to the right roller.** When a save or check is needed, the engine posts a **roll-request row** addressed to that player, with one `Roll DEX save (+2)` button and an "auto-roll for me" toggle. AI Realm made the player roll enemy damage; a gate must prevent that. Monster rolls are always the engine's. A human DM may roll secretly ([DDB secret rolls](https://www.dndbeyond.com/posts/939-share-your-dice-results-with-the-brand-new-game)).
4. **Reactions and interrupts.** Each character has a reaction policy per reaction: Ask / Auto / Off, following BG3 ([wiki](https://bg3.wiki/wiki/Reactions)). The default is Ask for anything that spends a slot. When a trigger fires, the engine pauses the turn and shows an **inline reaction row** to that player only: `Goblin 3 leaves your reach — Opportunity attack? [Strike] [Let it go] 8s`. The countdown is visible, and the default on timeout is "let it go". The same row serves Shield, Counterspell and Uncanny Dodge. This is the "interrupt strip" from decision-0028, made concrete.
5. **Legible proposals and rulings.** Every DM ruling in the stream carries a **"why" expansion** with the rule cited, the DC and the engine primitive used (constitution V: citations). For the human-DM `ask`/`suggest` settings, AI proposals appear as **proposal rows** in the DM's view only: `Proposed: Mara lies — Insight DC 14 [Accept] [Edit] [Reject]`. Edit opens inline, never a modal. A **"DM's notes" slide-out** shows what the AI DM is working from (scene facts, active NPC goals, the clocks), modeled on [F&F Working Context](https://help.fables.gg/articles/8560008-working-context-blocks). It is read-only for players and editable for a human DM.

---

## 4. Combat

### What the trackers teach
- The initiative bar sits **at the top** and is visible to everyone ([DDB Maps](https://www.dndbeyond.com/posts/1841-roll-for-initiative-combat-tracking-comes-to-the)). A round counter is built in, since Roll20 lacks one. The tracker syncs with sheet HP.
- Text combat can be complete, as [Avrae](https://avrae.io/commands/) shows. Its grammar is verb + target, with the flags hidden.
- **AoE**: a grid uses a measured template with auto-targeting ([Foundry measurement](https://foundryvtt.com/article/measurement/); [DF Template Enhancements](https://foundryvtt.com/packages/df-templates)). Text uses zones with a target-count table: small 2, medium 3, large 4, huge 8+ ([Sly Flourish via DDB/Goodreads](https://www.goodreads.com/author_blog_posts/20181603-zone-based-combat-in-d-d)).
- **Text movement**: count moves in named zones, not feet. "Engaged / near / far" range bands work ([EN World](https://www.enworld.org/threads/best-advice-for-running-theater-of-the-mind.690972/); [DDB TotM](https://www.dndbeyond.com/posts/325-why-run-combat-in-the-theater-of-the-mind)).
- **Speed**: static monster initiative (bonus + 10), side initiative for easy fights, fewer distinct monster types, and combat "outs" ([Sly Flourish](https://slyflourish.com/side_initiative.html); [13 tips](https://www.goodreads.com/author_blog_posts/21208063-13-tips-to-speed-up-d-d-combat)).

### Recommended turn flow (both modes)
1. The **turn banner** appears in the margin and the stream: `Round 2 · Thorin's turn` with the economy pips **Action ● Bonus ● Move 30ft ● Reaction ●**.
2. The active player's composer switches to **combat mode**. The action bar shows above the input, filtered to what is legal now. Free text still works. The pips drain as intents resolve.
3. **Targeting**: type `@` for a list of in-range targets, sorted by distance. Each shows HP state (healthy / bloodied / near death) and AC if known. On the map, click a token. In text mode, click a zone chip.
4. **Resolution** is instant from the engine, a code path with no model call. The narration line streams in afterwards and does not block the next turn. **This is the key latency lever**: mechanics resolve in under 1 s, and flavour arrives asynchronously.
5. **End turn** is explicit (a button, or `/end`), or automatic when all pips are spent.
6. **Off-turn players** stay active. They can plan in party chat, set reaction policy, and **pre-declare** ("on my turn: Fireball the cluster"). The pre-declared intent waits as a pending pill and fires on their turn after one confirm. This uses the wait instead of making it idle (the Heroes VII simultaneous-turns lesson in [the latency search](https://itch.io/post/7608462)).
7. **Monster turns** batch. All monster actions of one initiative slot post as one compact block, plus one narration paragraph.
8. **Conditions** are chips on the portrait in the margin and the tracker, with remaining duration (`Prone`, `Frightened 2r`). Hover or tap shows the SRD text. The stream logs each apply and expire for screen-reader parity.
9. **Death saves**: the downed PC's margin card shows three ✓ and three ✗ slots. The roll-request row appears at the start of their turn. Party members see `Thorin is dying (1✓ 1✗)` and a "Stabilize / Heal" quick draft.

### Text-only combat speed
- Use **zones** (named, 2–5 per scene) as the position model when no map exists. They are a minimal spatial state that the engine can check for range and AoE.
- Show **zone chips** in the margin: `[Ledge: Thorin, Goblin 1] [Bridge: Mara] [Far bank: Archer ×2]`. Clicking one drafts a move.
- **AoE in text**: pick a zone, then the engine lists who is in it and applies the target-count cap. The player confirms or deselects inline.
- **Never a model call to resolve a number.** The goal is a full round of 4 PCs and 4 monsters in under 60 s of wall time, with narration streaming behind it.

### Grid combat
- Movement: drag a token to show a ghost path with a feet counter, opportunity-attack warnings in red, and difficult terrain. The drop drafts `/move` and does not commit it, per the click-to-draft ruling. A setting allows "commit on drop" for human-DM tables that want speed.
- AoE: choose the spell, a template follows the cursor, the tokens inside highlight, and the click drafts the intent with the auto-target list.
- The grid and the zones are the same model at two resolutions. A zone is a named region of authored geometry (mud-ux OQ1: authored geometry).

---

## 5. Character sheet

- **The sheet is an action surface, not a document.** Every rollable number is a button that drafts an intent ([DDB](https://www.dndbeyond.com/posts/1003-how-to-customize-your-character-sheet-on-d-d)).
- It lives in a **slide-out drawer**, left or right on desktop and a bottom sheet at 390px, per the panel component. It never covers the composer, so the player can click on the sheet and see the draft appear.
- **Tabs**: Actions (filter: Action / Bonus / Reaction, as DDB does), Spells (slots as pips, filtered by castable now), Inventory, Features, Notes.
- **Live state**: HP, slots and conditions come from the event log. Changes animate briefly, and the stream records them.
- **Level-up**: a stepped flow inside the drawer (HP → features → choices → spells → review). It should have Restart and "modify choices", following the [dnd5e Advancement](https://github.com/foundryvtt/dnd5e/wiki/Advancement-User-Guide) flow. It is triggered by a level-up row in the stream. Each step is inline; there is no wizard modal. In AI-DM play the AI may **suggest** picks for the build ("Recommended: Great Weapon Master, because…"). The player chooses.
- **Inventory**: drag or tap an item to Use / Give / Drop / Equip, which drafts an intent. "Give to @Mara" uses the same autocomplete. Show carrying weight only if the table enables encumbrance.
- **Spells**: tap to cast, then the upcast level is a slot chip in the draft pill. Concentration shows in the margin with a "drop concentration" control.

---

## 6. Layout

- **One stream plus a margin** (ruled in mud-ux) is right. The research supports it. Split-pane VTTs (Foundry, Roll20) push chat into a 300px column, and narrative products (Alchemy, Hidden Door, AI Dungeon) centre the text. Ours is narrative-first with the map on demand.
- **Filter chips** over the one stream: All · Story · Rolls · Table talk · Whispers. These are view filters only (mud-ux OQ2).
- **Panels** are all slide-outs of one component: Sheet, Map, DM's notes, Codex lookup, Party. At most **one docked plus one floating** at desktop widths of 1440px or more; the map may dock at wide widths. At 1280px only one is open. At 390px a bottom sheet holds one panel at a time.
- **Mobile**: a margin mini-strip above the composer shows HP, turn and pips. In combat the action bar becomes a horizontal scroller. Targets use the `@` dropdown, never pinch-on-map.
- **Accessibility**:
  - The stream is `role="log"` plus a redundant `aria-live="polite"`, labelled, and append-only ([MDN log role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role); [W3C ARIA23](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA23.html)). Older history loads in a separate region so that prepending does not break announcements.
  - Turn changes and reaction prompts use a separate assertive region, addressed only to that player.
  - Every map fact is also stream text (ruled). Keyboard targeting is sorted by distance, as [Foundry Navigator](https://foundryvtt.com/packages/foundry-navigator) does, through `@`.
  - Reaction countdowns can be extended per user (WCAG 2.2.1 Timing Adjustable).
  - Never use colour alone for HP state. Use a word plus colour.

---

## 7. Unified interaction model: one command vocabulary

**Principle:** every surface (composer text, slash command, action bar, sheet, map, tracker, voice later) compiles to the same **Intent**. The server is the only place an Intent becomes an event. This is decision-0013 (the event log is the truth) applied to input.

```
Intent {
  kind, actor, channel?, targets[], params{}, text?, source: composer|bar|sheet|map|tracker,
  commit: draft|declared|confirmed
}
```

`draft` is in the composer. `declared` means sent, so the AI DM may still ask for a 👍 (decision-0028). `confirmed` goes to the gate and engine.

### Intent kinds

| Group | Kinds | Slash form | Notes |
|---|---|---|---|
| **Speech** | `say`, `say_to` (NPC/PC), `emote` | (plain), `@npc`, `/me` | `say_to` routes to the NPC voice |
| **Meta** | `ask_dm` (read-only), `ooc`, `party`, `whisper` | `@dm`, `((`, `/p`, `/w` | never mutate game state |
| **Deed (free-form)** | `attempt` (natural language → DM adjudicates) | (plain text classified, or `/do`) | the AI's interpretation shows as a proposal before commit |
| **Check** | `check`, `save`, `contest` | `/check athletics`, `/save dex` | engine resolves; DM sets DC |
| **Combat action** | `attack`, `cast`, `dash`, `dodge`, `disengage`, `help`, `hide`, `ready`, `search`, `use_object`, `grapple`, `shove` | `/attack`, `/cast`… | SRD action list |
| **Movement** | `move` (zone or path), `stand`, `drop_prone` | `/move bridge` | grid path or zone id |
| **Reaction** | `react` (opportunity attack, Shield, Counterspell, readied) | inline row only | answers an engine prompt |
| **Turn control** | `end_turn`, `predeclare`, `delay` | `/end` | |
| **Resource** | `use_item`, `give`, `equip`, `drop`, `rest_short`, `rest_long`, `concentration_drop` | `/use`, `/give`… | |
| **Roll answer** | `roll` (answers a roll request), `roll_free` | button, `/r 1d20+3` | free rolls are flavour unless requested |
| **Advancement** | `level_choice` | sheet drawer | |
| **DM control** (human DM or AI) | `narrate`, `npc_say`, `request_roll`, `set_dc`, `apply_damage/heal`, `apply_condition`, `start_combat`, `end_combat`, `add_combatant`, `move_token`, `reveal`, `ruling` (accept/edit/reject proposal), `pause` | `/desc`, `/as Mara`, `/gr` | AI DM emits the same kinds through the gate |
| **Session** | `retry_narration` (solo only, flavour only), `bookmark`, `recap` | | never retries engine results |

This one vocabulary gives four things:
- the AI DM and the human DM use the same verbs (one dial, decision-0015);
- external VTT adapters translate their events into Intents;
- tests can drive the table with plain Intent fixtures;
- accessibility comes for free, because every Intent has a text form.

---

## Wireframes

### W1. Table, text mode (exploration, 1280px)

```
┌─ the-stacks ▸ Sunless Citadel ▸ Session 3 ──────────────────────────────┬──────────────────┐
│ [All] [Story] [Rolls] [Table talk] [Whispers]                [DM notes ▸]│ PARTY            │
│─────────────────────────────────────────────────────────────────────────│ Thorin  22/31 AC18│
│ ▣ THE COLLAPSED STAIR                                                    │ ▓▓▓▓▓▓▓░░  ok     │
│   Rubble chokes the stair. Wind moans from a crack to the north.         │ Mara    9/18 AC13 │
│   Ways on: [north crack] [down the rubble] [back to the courtyard]       │ ▓▓▓▓░░░░░ bloodied│
│                                                                          │ Ivo(AI) 14/14 AC15│
│ Thorin  "Mara, can you squeeze through that?"                            │──────────────────│
│ Mara → Thorin  "If you hold the lantern, maybe."                         │ SCENE            │
│ (( Ivo's player: is the crack wide enough for a Medium creature? ))      │ [Meepo] kobold   │
│   └ DM: Barely — squeezing rules apply (½ speed, disadvantage). ▸why     │ [north crack]    │
│ Meepo (NPC)  "Dragon is THAT way! Meepo not go first."                   │──────────────────│
│ ⚄ Mara · Perception 17 (d20 12 +5)  ▸                                    │ [Open map ▸]     │
│ ┌ DM: Mara squeezes into the crack — is that your action?  [👍] [Not quite]│ [Sheet ▸]        │
│ └───────────────────────────────────────────────────────────────────────┘│                  │
│─────────────────────────────────────────────────────────────────────────│                  │
│ [Thorin ▸ scene ▾]  I hold the lantern up to the crack and @Meepo|       │                  │
│                     ┌──────────────────────┐                             │                  │
│                     │ @Meepo  kobold · NPC │                             │                  │
│                     │ @Mara   PC           │                             │                  │
│                     │ @dm     ask the DM   │                             │                  │
│                     └──────────────────────┘                     [Send ⏎]│                  │
└──────────────────────────────────────────────────────────────────────────┴──────────────────┘
```

### W2. Table with the map slide-out (1440px, map docked)

```
┌──────────────────────── stream (narrowed) ───────────┬──── MAP ─────────────────[× Close]┐
│ ▣ THE BRIDGE                                          │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ Goblin 1 "Pay the toll, stinky!"                      │  ░ LEDGE  ░░░ BRIDGE ░░ FAR BANK ░│
│ ⚄ Initiative: Mara 18, Gob 15, Thorin 11, Arch 9  ▸   │  ░ (T)(G1)  ═══(M)════   (A)(A) ░│
│ ── Round 1 · Mara's turn ──                           │  ░░░░░░░░░░░ chasm ░░░░░░░░░░░░░ │
│                                                       │   ruler: Mara→Archer 45ft        │
│                                                       │   [click token: draft target]    │
│ [Mara ▸ scene] [⚔ /attack shortbow → @Archer 1 ▾ adv?]│   [drag token: draft move]       │
│                                              [Send ⏎] │  Init: ▸Mara · Gob1 · Thorin · A │
└───────────────────────────────────────────────────────┴──────────────────────────────────┘
  Text twin in the stream: "Mara on Bridge; Goblin 1 and Thorin on Ledge; Archers ×2 on Far bank."
```

### W3. Combat turn (text mode, zones, active player)

```
┌ Round 2 · THORIN'S TURN ─ Action ● Bonus ● Move 25/25ft ● Reaction ● ──────── [End turn] ┐
│ ZONES: [Ledge: Thorin, Gob1] [Bridge: Mara] [Far bank: Archer1 (bloodied), Archer2]       │
│───────────────────────────────────────────────────────────────────────────────────────────│
│ ⚔ Goblin 1 attacks Mara — miss (14 vs AC 15) ▸                                            │
│ ⚄ Archer 1 → Thorin: hit, 6 piercing. Thorin 16/31 ▸                                      │
│   The arrow skips off your pauldron and bites into your arm.   ← narration streams after │
│ ┌ REACTION (Mara only) ─ Goblin 1 leaves your reach. Opportunity attack?                ┐ │
│ │ [Strike: rapier +5]  [Let it go]                          ⏱ 8s  [+ more time]         │ │
│ └───────────────────────────────────────────────────────────────────────────────────────┘ │
│───────────────────────────────────────────────────────────────────────────────────────────│
│ [Attack ▾] [Cast ▾] [Dash] [Dodge] [Disengage] [Help] [Shove] [Use item ▾]   ← action bar │
│ [Thorin ▸ scene]  ⚔ /attack greataxe → @Goblin 1 (Ledge, engaged)            [Send ⏎]     │
│ Off-turn (Mara's view): "Your turn next · pre-declare: [⚔ rapier → Goblin 1] [clear]"     │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### W4. Character sheet drawer (slide-out, composer stays visible)

```
┌──── stream ─────────────────────────┬── THORIN · Fighter 3 ──────────────────[× Close]┐
│ ...                                  │ HP 16/31 ▓▓▓▓▓░░░  AC 18  Speed 25  Init +1     │
│                                      │ Conditions: [Prone ✕]   Concentration: —        │
│                                      │ [Actions] [Spells] [Inventory] [Features] [Notes]│
│                                      │ Filter: (Action) (Bonus) (Reaction)              │
│                                      │ ┌──────────────────────────────────────────────┐ │
│                                      │ │ Greataxe     [+5]  1d12+3 slashing   [draft] │ │
│                                      │ │ Handaxe ×2   [+5]  1d6+3, thrown 20/60       │ │
│                                      │ │ Second Wind  ●  bonus · 1d10+3      [draft] │ │
│                                      │ │ Action Surge ●  1/short rest                 │ │
│                                      │ └──────────────────────────────────────────────┘ │
│                                      │ Skills: Athletics [+5] Perception [+3] ...      │
│                                      │ Saves:  STR [+5] CON [+4] ...                    │
│ [Thorin ▸ scene] ⚔ /attack greataxe →│ ↑ any [+n] drafts into the composer             │
│                    @…        [Send ⏎]│ ★ Level 4 ready → [Begin level-up] (inline steps)│
└──────────────────────────────────────┴─────────────────────────────────────────────────┘
```

### W5. Human DM view, AI in `suggest` (proposal rows)

```
┌ DM view ─ [All] [Story] [Rolls] [Proposals 2] [Whispers] ───────────────── [DM notes ▸] ┐
│ Mara  "I tell the guard we're from the Lords' Alliance."                                 │
│ ┌ AI proposal ─ Deception check, DC 13 (guard is wary, cites PHB-SRD "Deception") ▸why ┐ │
│ │ [Accept]  [Edit DC ▾ 13]  [Reject]  [Narrate my own]                                  │ │
│ └───────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ AI proposal ─ Guard line: "Papers, then. Everyone has papers." [Accept] [Edit] [✕]    ┐ │
│ └───────────────────────────────────────────────────────────────────────────────────────┘ │
│ [DM ▸ as Guard ▾] /desc The gate creaks...                                     [Send ⏎] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommendations for the replan

1. **Latency is a product requirement.** Engine resolution is synchronous and narration is asynchronous. Set a target of under 1 s for the mechanical result and under 10 s for first narration tokens. The decision-0028 quiet ring (10 s and more) should stay for exploration only. Combat uses explicit turns with immediate commit after the in-turn 👍 default is off. This is a revisit of decision-0028 for combat, for ratification.
2. **One Intent vocabulary** (section 7) becomes a contract in `packages/shared`. It goes before any VTT adapter or map work.
3. **Zones are first-class spatial state** before the grid exists. They unblock text combat range and AoE now (TASK-0139/0239 gaps in the digest) and become regions of the authored map later.
4. **Reaction policy + inline reaction row** fills the interrupt-strip gap.
5. **DM notes slide-out** (working context) for legibility, and **proposal rows** for the human-DM dial.
6. **Sheet drawer as action surface** with the click-to-draft pill. Level-up is inline.
