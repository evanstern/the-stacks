/**
 * Typed domain errors — the shared failure vocabulary for every seam in the
 * skeleton (FR-011). Lives in @stacks/core so api, worker, and db all speak
 * the same four classes without depending on HTTP or each other.
 *
 * Doctrine: HTTP is a boundary concern. Nothing in core/db/worker knows about
 * status codes; the mapping ErrorClass -> HTTP happens exactly once, at the
 * API edge (FR-018). Everywhere else, throw/catch DomainError by class.
 * See specs/007-v3-skeleton/data-model.md for the class taxonomy.
 */

// The four classes are a closed set, deliberately coarse:
// - unknown_thing:     the caller referenced something that doesn't exist (404-shaped)
// - unsupported_type:  we recognized the request but don't handle that variant (422-shaped)
// - dependency_down:   an external dependency (Postgres, ML sidecar) is unreachable (503-shaped)
// - internal_fault:    our own bug or invariant violation (500-shaped)
// The HTTP shapes above are hints for the API mapper only — never encode them here.
export type ErrorClass =
  | "unknown_thing"
  | "unsupported_type"
  | "dependency_down"
  | "internal_fault";

export interface DomainErrorInit {
  class: ErrorClass;
  message: string;
  /** Which pipeline seam failed (see SEAMS in skeleton-check.ts) — feeds the event trail. */
  seam?: string;
  cause?: unknown;
}

export class DomainError extends Error {
  readonly class: ErrorClass;
  readonly seam?: string;

  constructor(init: DomainErrorInit) {
    // Only pass { cause } when one exists: `new Error(msg, { cause: undefined })`
    // would still stamp an own `cause` property on the error, muddying logs.
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "DomainError";
    this.class = init.class;
    this.seam = init.seam;
  }
}
