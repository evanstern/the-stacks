/**
 * The domain-error -> HTTP translation table for the API boundary (FR-018,
 * specs/007-v3-skeleton/contracts/api.md "Error model"). ErrorClass itself is
 * transport-agnostic and lives in @stacks/core; this file is the only place
 * that knows which HTTP status each class earns. "unauthorized" is API-only —
 * the worker has no auth concept, so it is bolted on here rather than added
 * to the shared ErrorClass union.
 *
 * The envelope shape { error: { code, message } } is the contract's wire
 * format; every non-2xx body in the system goes through errorEnvelope so
 * clients (and tests) can rely on one shape.
 */
import type { ErrorClass } from "@stacks/core";

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
