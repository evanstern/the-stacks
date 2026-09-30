---
id: doc-0003
title: Frontend stack — rulings
type: specification
created_date: '2026-09-30 03:09'
tags:
  - ui
  - decisions
  - m-1
---
# Frontend stack — rulings

Status: **ratified 2026-09-29.** The operator accepted the proposal with no amendments. This doc backs the frontend-stack decision record and supersedes the Client row of architecture A1 ("SPA, not SSR").

## Rulings

1. **Router and rendering.** Use React Router 8 in framework mode, with SSR on by default.
   - Serve realtime and canvas routes client-only, through `clientLoader` and `HydrateFallback`. This covers the play surface (WebSocket event stream) and the M5 PixiJS tabletop.
   - React Router 8 is the current major. It requires Node 22.22+, React 19.2.7+, and Vite 7+, all of which the repo already meets.
2. **Styling.** Use Tailwind CSS v4 through `@tailwindcss/vite`.
3. **Components.** Use shadcn/ui, copied into `apps/web`.
   - Do not use `Dialog` or `AlertDialog` (no-modals rule). Use `Sheet` for slide-out panels and `Command` or `Combobox` for autocomplete.
   - Build forms from the shared Zod content contracts (architecture A5).
4. **Topology.** Mount React Router's `createRequestHandler` inside the Hono app as the last middleware.
   - It replaces the SPA shell fallback in `apps/server/src/static.ts`.
   - Keep one Node process. The compose topology does not change.
5. **Plane boundary.** Loaders and actions reach server data through a typed load context.
   - Define the load-context interface in `packages/shared`.
   - `apps/server` implements the load context and passes it to the request handler.
   - `apps/web` never imports `apps/server` (constitution III; the Biome boundary rules stay as they are).
   - Loaders do not call the app's own HTTP API.
6. **TanStack.** Remove TanStack Router. Remove TanStack Query unless a surface proves it needs a client cache; record that justification in the plan.

## Why

- The operator prefers this toolset, and no reason found outweighs that preference.
- The case against SSR is mild: every route is authenticated, there is no SEO, and the audience is small. SSR still gives first paint with loaded data and forms that work before hydration.
- Switching is cheap now: `apps/web/src` is 453 lines. M2 (Codex) is where the UI grows.

## Constraints kept

- Constitution IX (self-hostable): no CDN, no webfonts, and the `system-ui` font stack. shadcn components are local source, so this holds.
- The TASK-0028 chat-UI decision record's visual direction stands. Only its "Stack" constraint changes.
