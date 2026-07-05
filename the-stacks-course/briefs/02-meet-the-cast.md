# Module 2: Meet the Cast

Write file: `modules/02-meet-the-cast.html` containing ONLY `<section class="module" id="module-2">…</section>`. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags.

## Course-wide context (applies to every module)

**The app being taught:** "The Stacks" is a self-hosted web app for tabletop RPG (TTRPG) game masters. The operator uploads their own rulebooks and notes, then asks questions in a chat; answers cite the exact uploaded passages and the app refuses to answer without evidence. Tech: React web app, Python FastAPI backend, a background worker, Postgres, Qdrant (vector database), OpenAI.

**Learner:** a "vibe coder" — zero CS background. Tooltip every technical term aggressively. Tone: smart friend.

**Consistent actor set:** Web app 🖥️, API 🚪, Worker 🛠️, Postgres 🗃️, Qdrant 🧭, OpenAI 🤖 (OpenAI is an outside service, not one of the five containers).

**Course title:** "Inside The Stacks". Accent: amber/gold (pre-configured).

## Teaching Arc

- **Metaphor:** A film set on shoot day. `docker-compose.yml` is the **call sheet**: it lists who's on the crew, when each person shows up (`depends_on`), how you check they're ready ("ready on set!" = healthchecks), and which rooms they work in (volumes/ports). Nobody starts filming until the crew they depend on has called "ready."
- **Opening hook:** "One command — `docker compose up` — and five separate programs wake up in the right order, find each other, and start cooperating. Who ARE these five?"
- **Key insight:** The app is five specialists in separate containers, each with one job, connected by a private network where every service is reachable by its *name* (the API literally dials `postgres:5432` like an internal phone extension).
- **Why should I care:** Knowing the cast lets you steer AI precisely ("put that logic in the worker, not the API") and localize failures ("uploads stall → suspect the worker; login fails → suspect the API").

## Screens (suggested, 5)

1. **The call sheet.** Intro the metaphor + one short paragraph: everything you saw in Module 1 was performed by five programs, each in its own container (tooltip "container": a sealed box holding one program plus everything it needs to run).
2. **HERO VISUAL — five cast cards** (pattern/feature cards), one per service: Web app 🖥️ "the storefront — the pages you see" (React); API 🚪 "the front desk — checks IDs, takes requests, orchestrates answers" (FastAPI/Python); Worker 🛠️ "the back room — processes uploads while you do other things" (Python loop); Postgres 🗃️ "the ledger — remembers everything: messages, uploads, jobs, citations"; Qdrant 🧭 "the meaning-finder — a special database that searches by similarity, not by exact words". Plus a sixth, visually offset card: OpenAI 🤖 "the outside contractor — turns text into meaning-numbers and drafts answers."
3. **Group chat animation** — boot-up morning on set (see below).
4. **Code↔English:** snippet A (the postgres call-sheet entry, YAML) and snippet B (settings via environment variables). Callout: services find each other by service NAME on Docker's private network — but your browser is OUTSIDE that network, so it reaches the API via localhost. That's why there are two different addresses for the same API.
5. **The login gate + quiz.** Short screen on how the Web app guards pages: snippet C (requireAuth) as a mini code↔English. Aha callout: the browser never holds a password after login — it holds a signed, HTTP-only cookie, like a stamped wristband the bouncer checks at every door. Then the quiz.

## Code Snippets (pre-extracted — use verbatim, never edit)

### Snippet A — the postgres entry on the call sheet
File: `docker-compose.yml` (lines 4–18) — YAML

```yaml
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: thestacks
      POSTGRES_USER: thestacks
      POSTGRES_PASSWORD: thestacks
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U thestacks -d thestacks"]
      interval: 5s
      timeout: 5s
      retries: 20
```

Teaching notes: `image` = which program to run; `volumes` = a keep-forever drawer so data survives restarts; `ports` = a window opened to your machine; `healthcheck` = how Docker asks "ready on set?" every 5 seconds.

### Snippet B — the settings sheet (backend config)
File: `apps/api/app/config.py` (lines 11–17) — Python

```python
    session_cookie_secure: bool = Field(default=False, alias="SESSION_COOKIE_SECURE")
    session_ttl_seconds: int = Field(default=7 * 24 * 60 * 60, alias="SESSION_TTL_SECONDS")
    database_url: str = Field(
        default="postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks",
        alias="DATABASE_URL",
    )
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")
```

Teaching notes: every knob reads from an environment variable (tooltip!) with a safe local default — same code, different behavior in dev vs production (e.g., secure cookies get forced ON in production). Point out `@postgres:5432` inside the URL: the service is addressed by its call-sheet *name*.

### Snippet C — the door guard on every protected page (frontend)
File: `apps/web/app/lib/auth.ts` (lines 5–14) — TypeScript

```ts
export async function requireAuth() {
  try {
    await getAuthStatus();
  } catch (error) {
    if (isUnauthorized(error) || isApiNetworkError(error)) {
      throw redirect("/login");
    }
    throw error;
  }
}
```

Teaching notes: before ANY protected page renders, this asks the API "am I logged in?" — a 401 answer (tooltip: HTTP's code for "who are you?") bounces you to the login page.

## Interactive Elements

- [x] **Group chat animation** (MANDATORY for this module) — id like `boot-chat`. Cast: Postgres 🗃️, Qdrant 🧭, API 🚪, Worker 🛠️, Web app 🖥️. Boot-up conversation, roughly:
  1. Postgres 🗃️: "Ledger's open. pg_isready says ✅"
  2. Qdrant 🧭: "Meaning-cabinet online at port 6333 ✅"
  3. API 🚪: "Great — dialing postgres:5432 and qdrant:6333… connected. Front desk open."
  4. Worker 🛠️: "API healthy? Cool. I'll check the job pile every 5 seconds. …anything yet?"
  5. Postgres 🗃️: "Nothing yet."
  6. Worker 🛠️: "…now? (I will literally never stop asking.)"
  7. Web app 🖥️: "Storefront's open on port 5173. First visitor incoming!"
- [x] **Code↔English translations** — snippets A, B, C above.
- [x] **Quiz** — 3–4 questions, architecture/debugging style:
  1. (Architecture) "You want a nightly job that emails you a recap of yesterday's session. Which cast member is the natural home for it?" → Worker (background work on a schedule, no user waiting). Explain why not the Web app (it only runs while a browser is open) or Postgres (it stores, doesn't act).
  2. (Debugging) "Chat answers fine, but new uploads sit at 'queued' forever. Which container do you suspect?" → Worker down; API and databases are clearly fine because chat works.
  3. (Debugging) "Everything works on your machine, but on the server the browser console shows the Web app's requests being blocked as 'cross-origin'." → CORS_ORIGINS setting on the API — configuration, not code.
  4. (Architecture) "Qdrant crashes. What still works?" → login, viewing old chats, uploads queueing (Postgres things) — but new answers fail, because similarity search is Qdrant's one job.
- [x] **Glossary tooltips** — container, Docker, Docker Compose, environment variable, port, volume, healthcheck, CORS, cookie, HTTP-only, 401/Unauthorized, YAML, dev vs production, localhost.
- [ ] Data flow animation — NO (Modules 1 and 3 have them).

## Reference Files to Read

- `references/content-philosophy.md` — all
- `references/gotchas.md` — all
- `references/interactive-elements.md` → sections: "Code ↔ English Translation Blocks", "Multiple-Choice Quizzes", "Group Chat Animation", "Callout Boxes", "Glossary Tooltips", "Pattern/Feature Cards"
- `references/design-system.md` → "Module Structure"

## Connections

- **Previous module:** Module 1 "The Question Journey" — traced one question end-to-end and introduced the actors only as a teaser. You can open with "In Module 1 you watched the relay race. Time for proper introductions."
- **Next module:** Module 3 "The Assembly Line" — follows an uploaded file through the Worker's pipeline (parse → chunk → embed → index). Bridge: "The quietest cast member — the Worker — has the most interesting job. Next module, we follow it into the back room."
- **Tone/style:** group chat container MUST have an `id` attribute. Keep text blocks ≤3 sentences, ≥50% visual.
