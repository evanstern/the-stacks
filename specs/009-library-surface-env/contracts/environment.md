# Contract: Environment & Worktree Protocol (v2)

**Feature**: 009-library-surface-env | **Supersedes**:
`specs/007-v3-skeleton/contracts/environment.md` (which now carries a banner pointing
here). Single source of truth for (a) the variable contract `.env.example` documents
and (b) the per-worktree environment protocol — how a worktree mints its `.env`, which
ports it owns, and what its docker lifecycle may touch.

The 007 variable tables remain accurate; this contract does not re-list every variable
(`.env.example` is the enumerated, commented inventory — FR-011). What is NEW here is
the protocol.

## 1. The worktree environment protocol

The repo runs bare + sibling worktrees (`.bare/` plumbing; `main/` deploy-oriented;
one sibling worktree per feature). **Every worktree owns a complete, isolated stack**:
its own `.env`, compose project, port block, containers, networks, and volumes.

### Minting a worktree's `.env` (FR-011, FR-013)

One step, from the new worktree's root:

```bash
node scripts/mint-worktree-env.mjs --secrets-from ../main/.env
```

The tool:

1. Reads `.env.example` as the template (it stays the variable contract).
2. Derives the worktree's identity and port block (§2) and the port-coupled values
   (`API_INTERNAL_URL` — see §4 footguns).
3. Copies the two secrets (`OPERATOR_PASSWORD_HASH`, `SESSION_SECRET`) from
   `--secrets-from`, or leaves them blank with a loud warning. It never invents
   secrets and the result is never committed (`.env` is gitignored).
4. **Refuses** if `.env` already exists (re-mint is `--force`, a deliberate act).
5. Scans sibling worktrees' `.env` files and **refuses on any port intersection** —
   collisions are caught at mint time, not as a runtime bind failure (spec edge case).
6. Prints the minted profile as a table — the protocol's CLI visibility avenue
   (constitution v2.2.0 Principle V; spec FR-018).

Drift check (FR-016), after `.env.example` gains/changes variables:

```bash
node scripts/mint-worktree-env.mjs --check   # nonzero exit + report on drift
```

Reconciliation is explicit: re-mint with `--force` (then re-copy secrets), or edit by
hand following the report. There is no silent auto-repair.

### 2. Deterministic identity & ports (FR-012)

Let `NNN` = the worktree's feature number (numeric prefix of its directory/branch
name, e.g. `009-library-surface-env` → 9). Then:

| Value | `main/` | Feature worktree |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `the-stacks-v3` | `the-stacks-<worktree-dirname>` |
| `V3_WEB_PORT` | 4400 | `4400 + 10×NNN` |
| `V3_API_PORT` | 4401 | `4401 + 10×NNN` |
| `V3_ML_PORT` | 4402 | `4402 + 10×NNN` |
| `V3_POSTGRES_PORT` | 5442 | `5442 + 10×NNN` |

Worktree `009-*` ⇒ 4490 / 4491 / 4492 / 5532, project `the-stacks-009-library-surface-env`.

Uniqueness is **inherited from feature-number uniqueness** (spec-kit assigns NNN
sequentially) — determinism replaces registration; the mint tool's sibling scan merely
verifies it. All dev publishes keep binding `127.0.0.1`; the prod overlay
(`docker-compose.prod.yml`) is out of scope and unchanged.

### 3. Deliberate overrides (FR-014)

An override (e.g., the historical web-on-4500 instance) is legitimate when it is:

- **recorded in that worktree's `.env`** (mint first, then edit the one value), and
- **reproducible from documentation** — note it where the worktree's purpose is
  recorded (the spec's evidence, a wiki page, or the PR description), and
- **outside derived blocks**: manual ports SHOULD sit ≥ 10000. (Cautionary tale:
  4500 *is* feature 010's derived web port — a manual override there collides with the
  next spec's worktree by construction.)

Tracked files (`.env.example`, compose files) never change for an override.

### 4. Port-coupled values (the known footguns, made mechanical)

| Variable | Rule | Why |
|---|---|---|
| `API_INTERNAL_URL` | `http://api:<V3_API_PORT>` — the api container binds `process.env.V3_API_PORT` *inside* the container | forgetting it = ECONNREFUSED from every web loader (this warning previously lived only as a compose comment) |
| `EMBEDDING_ENDPOINT` | stays `http://ml:4402` | the ml container's internal port is fixed; only its host publish (`V3_ML_PORT`) moves |
| `DATABASE_URL` | stays `…@postgres:5432/…` | in-network host/port; only the host publish (`V3_POSTGRES_PORT`) moves |

The mint tool derives all three; hand-editing them is what `--check` catches.

## 5. Docker lifecycle rules (FR-015)

Compose project identity is the isolation boundary: every command below acts on the
project named in the **current worktree's** `.env`, and therefore cannot touch another
worktree's stack — run from the wrong directory, it still only affects that
directory's project (spec edge case).

| Action | Command (worktree root) | May touch | Must never touch |
|---|---|---|---|
| Start | `docker compose up -d --build --wait` | this project's containers/networks/volumes | anything of another project |
| Stop | `docker compose down` | this project's containers/networks | volumes (data survives) |
| Full teardown | `docker compose down --volumes` | this project's containers/networks/**volumes** | anything of another project |
| Merge-time cleanup | full teardown, **then** `git worktree remove` | — | — |

Zero residue at worktree retirement is an acceptance criterion (SC-006): teardown
precedes `git worktree remove`, and `docker volume ls` filtered by the project name
must come back empty afterwards.

## 6. Succession & pointers (FR-017)

- `specs/007-v3-skeleton/contracts/environment.md` → banner: superseded by this file.
- `.env.example` header comment → points here.
- `AGENTS.md` "Ports and env" + "Worktree safety" and `README.md` → state the
  protocol (mint command, derivation rule, lifecycle table) instead of warning
  vaguely; the old "Compose project name stays `the-stacks-v3`" line is re-scoped to
  `main/` only.
