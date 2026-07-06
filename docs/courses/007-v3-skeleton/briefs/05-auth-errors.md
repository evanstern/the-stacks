# Module 5: Auth & Typed Failure

Write to: `modules/05-auth-errors.html` — `<section class="module" id="module-5">` only.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
*sealed cookie* ("encrypted + authenticated cookie — the server can read it, nobody can forge or
inspect it; tampering fails decryption and reads as 'no session'"), *deny-by-default*, *D13*
("fixed decision: single-operator auth — one password, no accounts"), *FR-018* ("spec requirement:
the four error classes are each pinned by at least one contract test").

## Teaching Arc
- **Metaphor (auth):** A wax-sealed letter. The session isn't a locker-room ticket the server has
  to look up (no session table at all) — it's a letter sealed with the server's own signet ring.
  Any tampering breaks the seal, and a broken seal is simply *no letter*. Revocation = change the
  ring (rotate SESSION_SECRET).
- **Metaphor (errors):** Triage tags, not incident novels. Every failure in the system wears
  exactly one of four tags; only the ER front desk (the API edge) translates tags into what the
  public hears (status codes).
- **Opening hook:** "There is no users table, no sessions table, and no auth middleware per route.
  One bcrypt hash in env, one sealed cookie, one global hook — and an unknown URL returns 401, not
  404, on purpose."
- **Key insight:** Two single-point-of-truth designs: (1) auth is deny-by-default via ONE global
  onRequest hook with an explicit 4-route exemption list; (2) failure classification is decided
  where it happens (worker, ml client, routes throw DomainError), but translated to HTTP in ONE
  place. Nothing else in the codebase knows a status code.
- **Why should I care?:** These are the two patterns you'll extend first when building on this
  foundation — every new route is auto-guarded the moment it registers, and every new failure mode
  is just a class choice, with the transport mapping already pinned by contract tests.

## Screens (4-5)
1. Hook + the auth model in one visual: env `OPERATOR_PASSWORD_HASH` (bcrypt) + `SESSION_SECRET`
   → login compares → seals cookie → every later request unseals. No DB row anywhere. Tooltip
   *sealed cookie*, mention 30-day maxAge, HttpOnly, SameSite=Lax.
2. Code↔English Snippet A (the global guard): route-PATTERN keying (can't spoof exemptions),
   401-not-404 for unknown paths ("the API reveals nothing about its route map"), the fixed
   non-revealing "Sign-in failed." body for every credential-shaped failure.
   Callout ("aha!"): *deny-by-default means forgetting auth on a new route is impossible — the
   failure mode of forgetfulness is 401, not exposure.*
3. The four-class error system — **cards visual**: unknown_thing→404 · unsupported_type→415 ·
   dependency_down→503 · internal_fault→500 (+ the auth-only bolt-on unauthorized→401). Then
   Code↔English Snippet B (the whole mapping table — it's tiny, that's the point).
4. Classification at the seam — Code↔English Snippet C (ml-client): timeout/refused/503 =
   dependency_down (retryable, "wait"), any other non-2xx = internal_fault ("go fix config") —
   *the class encodes the operator's next action*. Mention the dimension-mismatch guard from
   Module 3 as internal_fault BEFORE any write.
5. Quiz + handoff: "Doctrine's clean on paper. Module 6 is the receipts: six real bugs this
   feature hit, and what each one taught."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `v3/apps/api/src/auth/session.ts` (lines 23 + 59-77)
```ts
const EXEMPT = new Set(["GET /health", "GET /ready", "POST /api/auth/login", "POST /api/auth/logout"]);

  // A global onRequest hook (not preHandler) so it also applies to routes that
  // don't exist yet — "every other route requires a valid session" (contracts/api.md).
  // Consequence worth knowing: an unauthenticated request to an unknown path
  // gets 401, not 404 — the API reveals nothing about its route map.
  app.addHook("onRequest", async (request, reply) => {
    // routeOptions.url is the route PATTERN (e.g. "/api/x/:id"), so exemption
    // can't be spoofed by crafting a matching raw URL; raw url is only the
    // fallback for unmatched (404-bound) requests, which are never exempt.
    const key = `${request.method} ${request.routeOptions?.url ?? request.url}`;
    if (EXEMPT.has(key)) {
      return;
    }

    if (!isSessionAuthenticated(request)) {
      // Same fixed "Sign-in failed." body as every credential failure — the
      // response never distinguishes missing vs. tampered vs. expired session.
      reply.code(401).send(errorEnvelope("unauthorized", "Sign-in failed."));
    }
  });
```

**Snippet B** — File: `v3/apps/api/src/errors.ts` (lines 15-29)
```ts
const STATUS_BY_CLASS: Record<ErrorClass | "unauthorized", number> = {
  unknown_thing: 404,
  unsupported_type: 415,
  dependency_down: 503,
  internal_fault: 500,
  unauthorized: 401,
};

export function statusForErrorClass(errorClass: ErrorClass | "unauthorized"): number {
  return STATUS_BY_CLASS[errorClass];
}

export function errorEnvelope(errorClass: ErrorClass | "unauthorized", message: string) {
  return { error: { code: errorClass, message } };
}
```

**Snippet C** — File: `v3/apps/worker/src/ml-client.ts` (lines 59-80)
```ts
  // 503 is the sidecar's documented "model still loading / not ready" answer
  // (contracts/ml-sidecar.md) — reachable but not serving, still a down
  // dependency from the run's point of view, and retryable.
  if (response.status === 503) {
    throw new DomainError({
      class: "dependency_down",
      seam: "inference",
      message: "Inference sidecar is not ready.",
    });
  }

  // Any other non-2xx (400 unknown model, 404, ...) means we sent something
  // the contract doesn't allow — a misconfiguration on our side, so it must
  // NOT masquerade as a down dependency: the operator should go fix config,
  // not wait for the sidecar to "come back".
  if (!response.ok) {
    throw new DomainError({
      class: "internal_fault",
      seam: "inference",
      message: `Inference sidecar returned ${response.status}.`,
    });
  }
```

## Interactive Elements
- [x] **Code↔English translations** — Snippets A, B, C.
- [x] **Cards visual** — the four error classes (+unauthorized) as five tag-style cards: class,
  status, one-line meaning, "operator's next move" (retry-later / fix-config / fix-bug / no such
  thing / sign in).
- [x] **Quiz** — 3 scenario questions:
  1. "You add `GET /api/corpus` next sprint and forget everything about auth. Who can call it?"
     (Only a valid session — the global hook guarded it the moment it registered; the exemption
     list is the only escape hatch and it's explicit.)
  2. "Sidecar returns 404 'model not loaded is not the loaded model'. Which class does the worker
     throw, and why NOT dependency_down?" (internal_fault — the sidecar is up and answering; our
     config asked for the wrong thing. Waiting won't fix config.)
  3. "Ops asks 'why does hitting a nonexistent API path unauthenticated give 401 not 404?'"
     (Deny-by-default runs before routing decisions leak; the route map is invisible to the
     unauthenticated.)

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/gotchas.md` (all)
- `references/interactive-elements.md` → "Code ↔ English Translation", "Multiple-Choice Quiz",
  "Pattern/Feature Cards" (or nearest card pattern), "Callout Boxes", "Glossary Tooltips".

## Connections
- **Previous:** Module 4 "The Postgres Queue" — retries and the append-only trail; failures there
  arrive wearing these classes.
- **Next:** Module 6 "The Bug Ledger" — six real bugs from this feature's live validation.
- **Tone/style:** teal accent; actors Web/API/Postgres/Worker/Sidecar.
