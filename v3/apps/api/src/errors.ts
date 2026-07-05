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
