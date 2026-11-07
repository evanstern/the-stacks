# VTT research: build, embed, or adapt

**Date:** 2026-11-06. **For:** replan-2026-11, brief ruling "VTT: research build-vs-embed-vs-adapter and recommend. Operator decides."
**Context read:** `brief.md`, `../../vision.md`, `../../architecture.md` (A4, A8, A12, A13), `../../mud-ux/decision.md`, cards TASK-0068, -0070, -0071, -0072, -0239.
**Standing posture:** decision-0013 already says "our server owns state; own in-app table view plus adapters". This file tests that posture against the market and the tech, and proposes the phased path.

Confidence marks: **[cited]** = from the linked source; **[inferred]** = my reading of cited evidence; **[memory]** = not verified this session, check before relying on it.

---

## 0. Recommendation (short form)

**Hybrid, build-led.** Build a small in-app tactical grid that is a pure projection of the session event log. Keep exactly one live adapter as a later, trigger-gated phase, and keep Universal VTT export. Do not embed an open-source VTT.

Why, in one line each:

1. **No external VTT can keep a secret from a player's browser.** Foundry and Owlbear both enforce hiding in the client [inferred, §1]. An AI DM with hidden monsters needs server-side withholding, which only our own projection gives.
2. **No embeddable web VTT has a usable licence and a matching architecture.** Owlbear legacy is non-commercial; MapTool is AGPL Java desktop; Atlas is an AGPL Obsidian plugin; PlanarAlly is MIT but brings its own server and state model [cited, §1].
3. **The grid we need is small.** Our maps are structured data first (MapPlan, A8), so walls, rooms and fog are known by construction. A square-grid board with tokens, room-based fog, measurement and click-to-draft is weeks, not quarters (§2).
4. **AI-operability decides it.** The AI DM must read and write the map through the same gate as everything else (A10, A12). That is natural in our own command vocabulary and awkward through any third-party API (§5).

The operator's MUD-UX decision (slide-out map, click-to-draft, text parity, no Board layout) already describes a build, not an embed.

---

## 1. Landscape

### 1.1 Commercial VTTs

| Product | Model | Integration surface | Fit as adapter target |
|---|---|---|---|
| **Foundry VTT** | $50 perpetual licence per host server; self-hosted Node server [cited](https://foundryvtt.com/purchase/), [FAQ](https://foundryvtt.com/article/faq/) | Module system under a "Limited License for Package Development"; packages must not "function in the absence of the base software" [cited](https://foundryvtt.com/article/license/). No native external API; community modules open an outbound WebSocket from the GM's browser to a relay [cited](https://github.com/ThreeHats/foundryvtt-rest-api), [foundry-api-bridge](https://foundryvtt.com/packages/foundry-api-bridge). Canvas is PixiJS (v7 in v13; v8 upgrade postponed) [cited](https://foundryvtt.com/releases/13.332) | **Best live-adapter candidate.** Self-hosted, matches our audience. A GM browser must have the world open for any command to run [cited]. |
| **Owlbear Rodeo 2** | SaaS, free tier with all features; $3.99 / $7.99 per month for storage [cited](https://www.ttrpgstack.com/tools/owlbear-rodeo/), [docs](https://docs.owlbear.rodeo/docs/managing-your-subscription/). Not self-hostable [inferred](https://blog.colocataires.dev/posts/08-owlbear-rodeo/) | MIT SDK; extensions are iframes hosted on the developer's domain, may talk to external servers [cited](https://blog.owlbear.rodeo/building-an-extension-for-owlbear-rodeo-2-0/). `OBR.scene.items` add/update/delete/onChange, per-item metadata, `OBR.broadcast`, player role GM/PLAYER [cited](https://docs.owlbear.rodeo/extensions/apis/scene/items/), [player](https://docs.owlbear.rodeo/extensions/apis/player/). GPU dynamic fog with Wall and Light items since 2.3 [cited](https://blog.owlbear.rodeo/owlbear-rodeo-2-3-release-notes/) | **Easiest adapter to build** (it is a web page on our domain). But a cloud service sits between self-hosters and their table, which cuts against the self-host posture. |
| **Roll20** | Freemium; Mod scripts need Pro on the game owner [cited](https://wiki.roll20.net/Pro_Subscription) | Mods are sandboxed, "not accessible outside Roll20 games, nor are there any outward pointing endpoint" [cited](https://wiki.roll20.net/Mod:Development), [forum](https://app.roll20.net/forum/post/12278707/can-an-external-site-use-api) | **No.** Only a browser-extension bridge would work. UVTT import exists [cited](https://help.roll20.net/hc/en-us/articles/41643201127831-Universal-Virtual-Tabletop-UVTT-Support). |
| **Fantasy Grounds Unity** | Made free for all users, Nov 2025 [cited](https://en.wikipedia.org/wiki/Fantasy_Grounds) | Lua rulesets and extensions; deep 5e automation [cited]. No documented network I/O (A13 finding, unchanged) | Export target only (reads UVTT natively [cited](https://dev.to/bananafestdestiny/exporting-universal-vtt-dd2vtt-files-that-owlbear-rodeo-and-foundry-actually-import-checked-n32)). |
| **D&D Beyond Maps** | Free for all DDB users since 2025-09-16; fog, rulers, AoE overlays, initiative, shared game log; no dynamic lighting [cited](https://www.wargamer.com/dnd/free-vtt-launch). 2026 added Scene Prep and a "Theater of the Mind Organizer" map [cited](https://www.vice.com/en/article/dungeons-and-dragons-huge-dd-beyond-update-adds-dm-scene-prep-and-theater-of-the-mind-support/) | None public | **No.** But it is the UX bar for "sheet + map + log in one place". |
| **Alchemy RPG** | Free tier; cinematic, theater-of-the-mind first, with a per-scene tactical grid view and fog [cited](https://alchemyrpg.com/), [review](https://churapereviews.com/2025/04/11/why-alchemy-rpg-is-the-best-virtual-tabletop-for-storytelling/) | None public | **No.** It is the reference for the theater-of-the-mind ↔ grid continuum (§4). |
| **TaleSpire** | 3D block-builder; "Symbiotes" sidebar mods with an API; no 2D tokens by design [cited](https://talespire.com/faq) | Symbiotes | **No.** Wrong medium. |
| **Shmeppy** | Browser "wet erase mat"; no API found [cited, weak](https://gitnux.org/alternatives/foundry-vtt-alternatives/) | None | **No.** But its minimalism is close to our phase-1 target. |

**Hidden information.** No source states that Foundry or Owlbear withhold hidden tokens from player clients. The evidence points the other way: a Foundry v14 bug lets players select hidden tokens on scene load, so the client holds them [cited](https://github.com/foundryvtt/foundryvtt/issues/14880); Owlbear extensions use creator-only "local items" to hide things from players, and a community Owlbear rewrite lists "hidden items are withheld by the server" as new work [cited](https://github.com/spitefulFr0g/owlbear-rodeo-bun/issues/95). **[inferred]** Both enforce hiding at render time. This is the reason decision-0013 keeps them as projections: an adapter must receive only what that viewer may see, so the AI DM's hidden state stays on our server.

### 1.2 AI-DM competitors with maps

Friends & Fables advertises battlemaps, tokens, and natural-language or Attack-Panel targeting; its AI "can see your token" [cited](https://fables.gg/blog/ai-dungeon-diving-with-an-ai-game-master). Competitor blogs dispute how complete its combat map is today [cited](https://dungeonsdeep.ai/blog/friends-and-fables-review-2026). DungeonsDeep and TableForge both put a battle map on screen; TableForge resolves rules in code [cited](https://tableforge.gg/blog/friends-and-fables-vs-tableforge). **Every AI-DM product that has a map built its own.** None adapts Foundry or Owlbear.

### 1.3 Open-source / source-available VTTs (embed candidates)

| Project | Licence | Stack | Verdict |
|---|---|---|---|
| Owlbear Rodeo legacy (1.0) | Custom, **personal non-commercial only**; PRs disabled; unmaintained since Dec 2023 [cited](https://github.com/owlbear-rodeo/owlbear-rodeo-legacy) | React 17, Konva 8 + react-konva, Socket.IO, WebRTC [cited](https://github.com/owlbear-rodeo/owlbear-rodeo-legacy/blob/main/package.json) | **Excluded.** Incompatible with a public open-source project. Read for ideas only. |
| PlanarAlly | MIT [cited](https://github.com/Kruptein/PlanarAlly) | TypeScript client; own server [cited]. Vue client, Python server [memory] | Best licence, but it brings its own state model and server. Embedding means two sources of truth. Steal ideas. |
| MapTool (RPTools) | AGPL-3.0-or-later [cited](https://github.com/RPTools/maptool) | Java desktop | **Excluded.** Not web. |
| Atlas VTT | AGPL-3.0 [cited](https://github.com/atlas-vtt/atlas-vtt) | Obsidian plugin | Already an export-only target (A13). |
| gTove, Mipui | MIT [cited, aggregator](https://alternativeto.net/software/planarally) | Web | Too small to embed; Mipui is a map editor only. |
| Critter | Licence unread; 0 stars [cited](https://github.com/booskers/crittervtt) | Web + Node | Too new. |

Owlbear's own OSS pieces are useful references: SDK (MIT), dynamic-fog extension (open source; licence file not read) [cited](https://github.com/owlbear-rodeo/dynamic-fog).

**Embed conclusion.** "Embed" would mean forking a VTT and rewiring its state onto our event log. That is the expensive part of a VTT, so the fork saves the cheap part (drawing) and costs the hard part (state, auth, visibility). Rejected.

---

## 2. Rendering tech and effort

### 2.1 Library choice

| Option | Strength | Weakness | Fit |
|---|---|---|---|
| **PixiJS v8 + @pixi/react v8** | WebGL/WebGPU; fastest for many sprites, filters for fog/light; Foundry's choice [cited](https://foundryvtt.com/api/v13/index.html). @pixi/react v8 is built for React 19 only [cited](https://pixijs.com/blog/pixi-react-v8-live) | Lower level; text and hit-testing need care | **Pick.** Our client is React 19 (A1). Already named in TASK-0070. |
| Konva + react-konva | Easiest with React; built-in hit-testing, drag, transformers; 10k+ shapes with tuning [cited](https://konvajs.org/docs/faq.html). Owlbear 1.0 used it | Canvas 2D; fog/light compositing is slower; react-konva runs a separate React tree, so context must be bridged [cited](https://github.com/starfox-UwU/owlbear-rodeo) | Viable fallback if Pixi friction is high. |
| Phaser | Full game engine | Scene and loop model fights React; overkill | No. |
| SVG (React DOM) | Accessible, trivially hit-testable, CSS-styled, screen-reader friendly | Slow past a few thousand nodes; masks for fog get heavy | **Good enough for phase 1** if we want zero new deps; a 40×40 grid with 20 tokens is fine. |
| Raw Canvas/WebGL | Total control | We'd rebuild Pixi | No. |

Benchmarks favour Pixi on raw throughput, and React wrappers cost a lot on all of them [cited](https://github.com/slaylines/canvas-engines-comparison), [react-canvas-perf](https://github.com/ryohey/react-canvas-perf). Our maps are small (a dungeon room set, under 100 tokens), so throughput is not the deciding factor; fog compositing and future lighting are. **Recommendation:** Pixi v8 for the board; keep all game logic (grid math, LOS, AoE) in a renderer-free TypeScript module shared with the server, so the renderer stays swappable.

### 2.2 Features and effort

Effort = one implementer lane, working to a written spec, with the server projection already in place. **[estimate]**, ±50%.

| Feature | Approach | Effort |
|---|---|---|
| Square grid, pan/zoom, map image or tile render | Pixi viewport; MapPlan render from A8 (TASK-0069) | 1 wk |
| Tokens layer (PC/NPC/monster), selection, drag-to-draft | Token sprites from events; drag emits a *draft*, not a move (MUD-UX OQ4) | 1 wk |
| Measurement ruler, distance in squares/feet | SRD 5.2.1: every adjacent square costs 1, difficult terrain 2, no corner cutting past walls [cited](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) → Chebyshev distance plus a wall check | 3 days |
| **Room-based fog** (reveal a room/area) | MapPlan already has rooms; fog = unrevealed room polygons; reveal is a `map.revealed` event filtered per viewer server-side | 1 wk |
| Wall-based line of sight (per-token vision) | Rotational-sweep visibility polygon over wall segments [cited](https://www.redblobgames.com/articles/visibility/); compute on the server for hidden-info correctness, render the polygon as a mask | 2–3 wk |
| AoE templates (sphere, cube, cone, line, cylinder) | Shared geometry module; "affected squares" computed server-side so the engine, not the renderer, decides who is hit. SRD gives no grid template; pick a documented convention [cited, non-official](https://rpgbot.net/2024-dnd/area-of-effect-rules/) | 1–2 wk |
| Hex grids | Axial/cube coordinates [cited](https://www.redblobgames.com/grids/hexagons/); the SRD defines square grids only [cited] | 1 wk; **defer** (no 5e rule needs it) |
| Dynamic lighting (light radii, dim/bright) | Light sources as data; reuse the LOS polygon per light. 5e uses bright/dim/darkness, which is gameplay-relevant (Darkvision) | 2 wk; after LOS |
| Multi-level, elevation, animated effects, drawing tools | — | Defer; no end goal needs them for V1 |

**Phase-1 board (grid, tokens, draft, ruler, room fog): about 3–4 lane-weeks.** Adding LOS and AoE: about 4–5 more. A Foundry-class lighting stack is not on the path.

---

## 3. Real-time sync for an authoritative-server VTT

Our architecture already answers most of this: an append-only log, clients subscribe from a `seq` cursor, reconnect = replay, all mutations go through the server and its gate, and visibility is a field on the event with projections filtered per viewer (A4).

Patterns from the field:

- **Server-ordered, no CRDT.** Figma dropped true CRDTs because "our server is the central authority"; the server defines event order, so a last-writer-wins property register needs no timestamps [cited](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/). A VTT with a rules gate is even more centralized than Figma, because some writes are refused. **CRDTs do not fit:** they make every replica a writer, and refuse-before-write is the core of our gate (decision-0015).
- **Optimistic UI by rebase.** Replicache runs a mutator once optimistically on the client and again authoritatively on the server; on sync it rewinds to server state and replays pending mutations, and a replay may compute a different result or fail [cited](https://doc.replicache.dev/concepts/how-it-works), [rocicorp PR #6555](https://github.com/rocicorp/mono/pull/6555). Figma similarly hides incoming server values that conflict with unacknowledged local edits to avoid flicker [cited].

**Fit to the-stacks.** Split map interactions into two classes:

| Class | Example | Path | Optimistic? |
|---|---|---|---|
| **Ephemeral pointer state** | Hover, drag preview, ruler, ping | WebSocket presence channel, never logged (TASK-0051 decides presence) | Local only |
| **Game state** | Move a token, reveal a room, place an AoE | Command → gate → event → projection | **Ghost only:** render a translucent ghost at the target until the event lands or is refused. Never move the real token before the gate rules. |

This keeps one source of truth and avoids a client-side rebase engine (no Replicache, no new dependency). A refused move simply removes the ghost and shows the refusal row in the stream. Latency for a self-hosted single-tenant table is a LAN-to-WAN round trip plus the gate; for player moves that need no AI, the engine check is milliseconds. Where the AI DM must rule, the ghost stays until it does, which matches the existing confirm row.

---

## 4. Dual mode: text and direct manipulation emit one vocabulary

**Principle:** the map is an *input device for the composer and the command set*, not a second channel. Every gesture compiles to the same command a typed line would, and every resulting event renders as text in the stream (screen-reader parity, MUD-UX constraint).

| Gesture | Draft / command | Event(s) | Stream text |
|---|---|---|---|
| Drag own token to a square | Draft "I move to D7" → `move {actor, to:{x,y}}` | `token.moved` | "Ilsa moves to D7 (25 ft)." |
| Click a monster | Draft "I attack the goblin lookout" → `action.declared {target}` | as today (A12 lifecycle) | as today |
| Pick a spell, then a point | Draft "I cast Fireball at C4" → `action.declared {spell, origin}` | engine computes affected tokens; `action.resolved` | lists who was caught |
| Type "I take the left tunnel" | `move {actor, to: room "left tunnel"}` | `token.moved` (server resolves room → square) | same |
| DM clicks Reveal on a room | `map.reveal {room}` | `map.revealed` (visibility per viewer) | "The door opens onto …" |

Three properties make this work:

1. **Spatial references resolve server-side.** A command may target a square, a token, a room id or a named feature. The server resolves names against the MapPlan, so text and clicks converge on one schema.
2. **Drafts never commit.** The MUD-UX ruling (OQ4) already says a map click drafts into the composer and commit authority stays with A12. Turn mode may later allow a one-click "move and commit" for the active player only; that needs its own ruling.
3. **Theater-of-the-mind ↔ grid is a projection setting, not a mode switch.** The same scene state can render as (a) prose only, (b) a **zone map** (rooms and their occupants, no coordinates; fed by the MapPlan room graph), or (c) the full grid. Positions are optional per token: a token without a square sits in its room's zone. Alchemy (cinematic scene plus optional tactical grid) and DDB Maps' theater-of-the-mind organizer [cited, §1.1] show both ends exist in shipping products; the zone view lets one combat move between them without migrating state.

Foundry blends chat and map through chat cards with target lists and token highlighting on hover [cited](https://github.com/Zapgun/mars-5e), and Friends & Fables offers natural-language targeting plus an Attack Panel [cited, §1.2]. Our stream-first layout goes further than both: the text is the record and the map is a view of it.

---

## 5. AI-operability

**Reading the map.** The AI never reads pixels. The turn assembler (A11 `assemble`) gets a compact textual projection: rooms with exits, tokens with square, room, HP band and conditions, revealed state, plus precomputed facts it would otherwise hallucinate — distance between actors, who has line of sight to whom, who is in reach, cover. The engine computes those; the AI cites them. Friends & Fables' claim that its AI "can see your token" is the same idea [cited, §1.2].

**Writing the map.** The AI DM gets map tools that emit proposals through the gate, same as dice and HP (TASK-0071): `place_token`, `move_token`, `reveal_room`, `set_light`, `place_effect`. The engine validates speed, walls, occupancy and reach before any event. Human DMs use the same commands from the UI, so one gate covers both ends of the dial.

**Generating maps (structured first).** A8 already fixes this: the map-planner emits a Zod-validated MapPlan; a deterministic renderer draws it.

1. LLM proposes a **room graph** (rooms, purposes, connections, encounter slots) — the part it is good at.
2. A deterministic layout step places rooms and corridors on a grid. Proven algorithms exist: BSP splitting with sibling-corridor joining [cited](https://www.roguebasin.com/index.php/Basic_BSP_Dungeon_generation), or rot.js `Digger` / `Uniform`, which expose `getRooms()` with doors [cited](https://github.com/ondras/rot.js/blob/master/manual/pages/map/dungeon.html). Constraining layout to the LLM's graph needs a small custom step; rot.js is optional.
3. Walls, doors and room polygons fall out of the layout, so fog and LOS are correct by construction.
4. Render from a CC0 tile pack (TASK-0069); export to Universal VTT (`line_of_sight` walls, `portals` doors, `lights`, `pixels_per_grid`), which Foundry (via module), Owlbear, FGU, MapTool and Roll20 import [cited](https://dev.to/bananafestdestiny/exporting-universal-vtt-dd2vtt-files-that-owlbear-rodeo-and-foundry-actually-import-checked-n32), [Roll20](https://help.roll20.net/hc/en-us/articles/41643201127831-Universal-Virtual-Tabletop-UVTT-Support).

The same MapPlan serves the campaign-creation editors (end goal 4): the human DM edits the room graph or the layout, the AI fills in rooms, and both play from it.

---

## 6. Options matrix

Scores 1 (poor) to 5 (best). Weights reflect the brief: UX first-class (goal 3), AI-run table is a co-equal goal (goal 1), self-hosted open source (vision).

| Criterion (weight) | **Build** own grid | **Embed** OSS VTT | **Adapter only** (Foundry/Owlbear) | **Hybrid**: build + one adapter later + UVTT |
|---|---|---|---|---|
| UX quality, integrated with stream (×3) | 4 — exactly the MUD-UX design; less polish than Foundry at first | 2 — a second app's UX bolted on | 2 — players juggle two apps; text parity lost | **4** — own UX by default; power users keep their VTT |
| Effort (×2; 5 = least) | 3 — ~3–4 lane-weeks phase 1, ~8–9 to LOS/AoE | 2 — fork plus rewiring state onto our log | 3 — module small, but per-VTT upkeep against their release cadence | **3** — build cost, adapter deferred |
| Control / architecture fit (×3) | 5 — log is truth; server-side hiding | 2 — two state models | 2 — hidden info leaks to clients; GM browser must be open (Foundry); cloud in path (Owlbear) | **5** |
| Licensing (×2) | 5 — ours | 1–3 — non-commercial (OBR legacy), AGPL (MapTool, Atlas), MIT only for PlanarAlly | 3 — Foundry EULA permits packages; each host needs a $50 licence; OBR SaaS terms | **5** for core; adapter is optional |
| AI-operability (×3) | 5 — native commands through the gate | 3 — possible after rewiring | 2 — via relay APIs; AI must reconcile external edits | **5** |
| **Weighted total (max 65)** | **58** | **27–31** | **31** | **59** |

Hybrid edges Build only because it keeps a path for tables already invested in Foundry, at no cost until a trigger fires.

### Adapter choice (when its trigger fires)

**Foundry first** [inferred]: self-hosted like us, the largest 5e module ecosystem, and proven outbound-WebSocket module pattern. Cost: the GM's browser must run the world; players see hidden data if we send it, so the adapter must receive only the GM's or a public projection. **Owlbear second**: cheapest to build (an iframe page on our domain), but SaaS-only, and its fog lives in its own items. Decision-0013 already defers this choice to a decision record at the start of TASK-0072; this research does not pre-empt it.

---

## 7. Phased path

Each phase is a board-carded deliverable (A14: no unplanned "for now").

| Phase | Deliverable | Depends on | Effort [estimate] |
|---|---|---|---|
| **V0 — spatial state, no board** | Server projection: tokens (square optional), rooms, revealed set, per-viewer filtering; `move` / `reveal` commands through the gate; textual map facts in the AI turn context; zone rendering as text in the stream | MapPlan contract (TASK-0068) | 2 wk |
| **V1 — minimal tactical grid** | Slide-out panel (MUD-UX), Pixi board: square grid, tokens, click-to-draft target, drag-to-draft move with ghost, ruler, room-based fog; text parity for every fact | V0, TASK-0069 renderer | 3–4 wk |
| **V2 — tactical depth** | Server-side wall LOS and per-token vision, AoE templates with engine-computed hits, darkness/dim light for Darkvision, zone ↔ grid toggle | V1 | 4–5 wk |
| **V3 — AI and authoring** | AI DM map tools (TASK-0071), room-graph → layout → render map-planner, DM map editor in campaign tools | V0; parallel with V2 | 3–4 wk |
| **V4 — outward** | UVTT export (TASK-0073); one live adapter (TASK-0072) | V2. **Trigger for the adapter:** a named table or issue asks for it, or V1 playtests show a group refusing to leave its VTT | 1 wk export; 2–3 wk adapter |

Skipped: hex grids, elevation, multi-floor, drawing tools, animated effects. Add each when a playtest or an end-goal feature names it; card each as a revisit with that trigger.

---

## 8. Decisions for the operator

1. **Posture:** ratify Hybrid (build-led) — this re-affirms decision-0013, sharpened with the phase order above — or pick another column.
2. **Renderer:** PixiJS v8 (recommended) vs SVG for V1 (zero deps, best accessibility, a rewrite risk at V2 lighting).
3. **Adapter trigger:** accept the V4 trigger, or keep TASK-0072 scheduled unconditionally.
4. **Grid policy:** square only, SRD 5.2.1 movement, and a named AoE-template convention.

## Sources

Foundry: [purchase](https://foundryvtt.com/purchase/), [FAQ](https://foundryvtt.com/article/faq/), [EULA / package licence](https://foundryvtt.com/article/license/), [v13 API](https://foundryvtt.com/api/v13/index.html), [13.332 notes](https://foundryvtt.com/releases/13.332), [issue 14880](https://github.com/foundryvtt/foundryvtt/issues/14880), [REST API module](https://github.com/ThreeHats/foundryvtt-rest-api), [API Bridge](https://foundryvtt.com/packages/foundry-api-bridge), [mars-5e](https://github.com/Zapgun/mars-5e).
Owlbear: [items API](https://docs.owlbear.rodeo/extensions/apis/scene/items/), [player API](https://docs.owlbear.rodeo/extensions/apis/player/), [extension blog](https://blog.owlbear.rodeo/building-an-extension-for-owlbear-rodeo-2-0/), [2.3 notes](https://blog.owlbear.rodeo/owlbear-rodeo-2-3-release-notes/), [dynamic-fog](https://github.com/owlbear-rodeo/dynamic-fog), [subscription](https://docs.owlbear.rodeo/docs/managing-your-subscription/), [legacy repo](https://github.com/owlbear-rodeo/owlbear-rodeo-legacy), [legacy package.json](https://github.com/owlbear-rodeo/owlbear-rodeo-legacy/blob/main/package.json), [owlbear-rodeo-bun #95](https://github.com/spitefulFr0g/owlbear-rodeo-bun/issues/95).
Others: [Roll20 Mod dev](https://wiki.roll20.net/Mod:Development), [Roll20 Pro](https://wiki.roll20.net/Pro_Subscription), [Roll20 UVTT](https://help.roll20.net/hc/en-us/articles/41643201127831-Universal-Virtual-Tabletop-UVTT-Support), [Fantasy Grounds](https://en.wikipedia.org/wiki/Fantasy_Grounds), [DDB Maps free](https://www.wargamer.com/dnd/free-vtt-launch), [DDB theater of the mind](https://www.vice.com/en/article/dungeons-and-dragons-huge-dd-beyond-update-adds-dm-scene-prep-and-theater-of-the-mind-support/), [Alchemy](https://alchemyrpg.com/), [TaleSpire FAQ](https://talespire.com/faq), [PlanarAlly](https://github.com/Kruptein/PlanarAlly), [MapTool](https://github.com/RPTools/maptool), [Atlas VTT](https://github.com/atlas-vtt/atlas-vtt), [Friends & Fables](https://fables.gg/blog/ai-dungeon-diving-with-an-ai-game-master), [DungeonsDeep review](https://dungeonsdeep.ai/blog/friends-and-fables-review-2026), [TableForge](https://tableforge.gg/blog/friends-and-fables-vs-tableforge).
Tech: [@pixi/react v8](https://pixijs.com/blog/pixi-react-v8-live), [Konva FAQ](https://konvajs.org/docs/faq.html), [canvas engines benchmark](https://github.com/slaylines/canvas-engines-comparison), [react-canvas-perf](https://github.com/ryohey/react-canvas-perf), [Red Blob visibility](https://www.redblobgames.com/articles/visibility/), [Red Blob hexes](https://www.redblobgames.com/grids/hexagons/), [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), [AoE token method](https://rpgbot.net/2024-dnd/area-of-effect-rules/), [Figma multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/), [Replicache](https://doc.replicache.dev/concepts/how-it-works), [rocicorp #6555](https://github.com/rocicorp/mono/pull/6555), [RogueBasin BSP](https://www.roguebasin.com/index.php/Basic_BSP_Dungeon_generation), [rot.js dungeon](https://github.com/ondras/rot.js/blob/master/manual/pages/map/dungeon.html), [UVTT importers](https://dev.to/bananafestdestiny/exporting-universal-vtt-dd2vtt-files-that-owlbear-rodeo-and-foundry-actually-import-checked-n32).
