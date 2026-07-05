export type ErrorClass =
  | "unknown_thing"
  | "unsupported_type"
  | "dependency_down"
  | "internal_fault";

export interface DomainErrorInit {
  class: ErrorClass;
  message: string;
  seam?: string;
  cause?: unknown;
}

export class DomainError extends Error {
  readonly class: ErrorClass;
  readonly seam?: string;

  constructor(init: DomainErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "DomainError";
    this.class = init.class;
    this.seam = init.seam;
  }
}
