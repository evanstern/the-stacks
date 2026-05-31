# ikis.ai

> A single-user, self-hosted React Router 7 corpus app with SQLite or libSQL as
> the canonical store, grounded conversation, and cited context packs.

**Status:** re-chartered for the hostable corpus workspace plan.

**Internal codename:** The Stacks remains the codebase and project lineage name;
`ikis.ai` is the public product name used in user-facing surfaces.

## Why

ikis.ai is a workspace for grounded conversation over a curated corpus. It
does not try to be a generic chat product or a multi-user service. Instead, it
keeps the corpus, retrieval, and conversation loop close together so answers can
stay tied to source evidence.

The app target is React Router 7, self-hosted by the owner of the workspace, and
SQLite or libSQL is the canonical store for runtime truth. The user should be
able to ingest corpus material, inspect it, ask grounded questions, and produce
citations or context packs without leaving the workspace.

## Product target

- **App shell:** React Router 7.
- **Deployment shape:** single-user and self-hosted.
- **Public surface:** `ikis.ai`, with this workspace expected to fit naturally at
  `thestacks.ikis.ai` later if the codename becomes a subdomain.
- **Canonical store:** SQLite or libSQL.
- **Primary loop:** ingest corpus material, inspect it, ask grounded questions,
  and generate cited context packs.
- **Conversation rule:** responses must stay grounded in corpus evidence and say
  when evidence is thin or missing.
- **Formats:** EPUB and MOBI may be supported as corpus input or export formats
  where the workspace workflow benefits from them.
- **Reference history:** the #19 Go importer remains the parity reference for
  load behavior and record fidelity, but it is not the runtime architecture.
- **Orchestration note:** LangGraph is not the core product contract; if used at
  all, it is downstream of the workspace boundary.

## Roadmap

| Milestone | Shape | Done when |
|-----------|-------|-----------|
| V0.1 | Corpus ingestion + provenance | approved corpus material lands in SQLite or libSQL with audit trail |
| V0.2 | Searchable corpus workspace | chunks, source records, and metadata are browsable and searchable in the app |
| V0.3 | Grounded conversation | questions return cited answers instead of freeform guesses |
| V0.4 | Context pack compiler | Markdown/JSON packs cite selected chunks for a concrete task |
| Later | import parity + integration surfaces | #19 importer behavior remains reproducible, and optional API or MCP surfaces can mount the proven workspace |

Full design: [`designs/the-stacks.md`](designs/the-stacks.md).

## Local setup

Install dependencies and run the development server from this directory:

```bash
pnpm install
pnpm dev --host 127.0.0.1
```

Ikis requires a local owner password and signed-cookie secret before protected
routes can load:

```bash
IKIS_SHARED_PASSWORD=change-this-password
IKIS_AUTH_SECRET=<output of openssl rand -hex 32>
```

Runtime state defaults to `./data/the-stacks.sqlite`, with uploaded source bytes
under `./data/uploads`. Override those paths with `THE_STACKS_DB_PATH` and
`IKIS_UPLOAD_DIR` when running tests, a port-mapped local instance, or a
container. `PUBLIC_URL` should match the browser origin for hosted deployments;
local `http://` origins are supported for development.

## Workspace flow

1. Sign in at `/login` with `IKIS_SHARED_PASSWORD`.
2. Upload Markdown, text, EPUB, MOBI, or MediaWiki JSON from the workspace home.
3. Open `/review` and record the final human decision. LLM or LangGraph
   suggestions are advisory; approval is what makes content retrievable.
4. Ask grounded questions from `/chat`. Answers cite approved chunks and expose
   source previews plus retrieval traces for audit.

The current retrieval baseline is lexical SQLite FTS. Vector and hybrid retrieval
remain follow-up architecture work rather than hidden behavior in this slice.

## Verification

Use the focused commands before shipping changes:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

`pnpm e2e` starts an isolated Ikis dev server, logs in, uploads the Markdown
fixture, approves it, asks a cited question, opens the citation preview, and
checks EPUB/MOBI plus MediaWiki parity fixtures reach reviewable import status.

## Non-goals

- Cloud-first storage or retrieval.
- Treating flat files as the runtime source of truth.
- Replacing retrieval with graph search alone.
- Recasting the #19 Go importer as the product target.

## Historical reference

The Stacks remains the internal codebase/codename and historical project lineage
for the hostable corpus workspace now surfaced publicly as `ikis.ai`.

The #19 Go importer stays in the docs as parity history only. It is the
reference for ingest behavior, not the long-term app stack or UI shell.

## Optional LangGraph boundary

LangGraph is an orchestration sidecar only. `LANGGRAPH_ENABLED=false` keeps local
and e2e flows deterministic with the fake review provider. If a real sidecar is
enabled later, it must exchange IDs, summaries, and workflow refs with Ikis;
SQLite/libSQL remains canonical for sources, documents, review decisions,
conversations, retrieval runs, and citations.

## Status board

Project work is tracked with [focus](https://github.com/evanstern/focus) in
[`.focus/`](.focus/). The board now tracks the hostable corpus workspace
direction.

## License

MIT. See [LICENSE](LICENSE).
