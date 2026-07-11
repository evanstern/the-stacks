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
 *
 * "invalid_input" (400) joined "unauthorized" as an API-only code in 009 (a
 * request whose SHAPE is wrong — malformed query params caught by Fastify
 * schema validation — must not fall through to the scrubbed 500). 010 then
 * promoted invalid_input into the shared ErrorClass union: the engine's
 * embedding-stamp refusal is a domain-level input refusal, so "only the HTTP
 * edge can have malformed requests" stopped being true. "unauthorized"
 * remains genuinely boundary-only.
 */
import type { ErrorClass } from "@stacks/core";

/** ErrorClass plus the codes that only exist at the HTTP boundary. */
export type ApiErrorCode = ErrorClass | "unauthorized";

const STATUS_BY_CLASS: Record<ApiErrorCode, number> = {
  unknown_thing: 404,
  unsupported_type: 415,
  dependency_down: 503,
  internal_fault: 500,
  unauthorized: 401,
  invalid_input: 400,
};

export function statusForErrorClass(errorClass: ApiErrorCode): number {
  return STATUS_BY_CLASS[errorClass];
}

export function errorEnvelope(errorClass: ApiErrorCode, message: string) {
  return { error: { code: errorClass, message } };
}
