import type { Context, NotFoundHandler } from "hono";
import type { ErrorHandler } from "hono/types";

/** The structured error contract — see specs/003-hono-server/contracts/errors.md */
export type ErrorKind =
  | "validation"
  | "internal"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "conflict";

export interface ErrorIssue {
  path: string;
  message: string;
}

export interface ErrorResponseBody {
  error: {
    kind: ErrorKind;
    message: string;
    issues?: ErrorIssue[];
  };
}

const STATUS_BY_KIND = {
  validation: 400,
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  conflict: 409,
  internal: 500,
} as const;

/** Fixed, generic message for internal errors. Never varies with the underlying cause. */
const INTERNAL_ERROR_MESSAGE = "An internal error occurred.";

/** Thrown by route handlers when input fails validation. */
export class ValidationError extends Error {
  readonly issues: ErrorIssue[];

  constructor(issues: ErrorIssue[], message = "Request validation failed.") {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** Thrown by route handlers when a named resource does not exist. */
export class NotFoundError extends Error {
  constructor(message = "The requested resource was not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when a request isn't authenticated, or authenticates as the wrong
 * credentials. Sign-in uses this for BOTH an unknown username and a wrong
 * password with the same fixed message (FR-004, SC-003, contracts/http-auth.md)
 * — distinguishing them would leak which usernames exist.
 */
export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown when a caller is authenticated but their role doesn't permit the
 * action — e.g. a player calling the operator-only invitation endpoint
 * (FR-012, contracts/http-auth.md). Distinct from UnauthorizedError, which
 * means "who are you" rather than "you can't do that".
 */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when a request conflicts with existing state — e.g. a taken username (contracts/http-auth.md). */
export class ConflictError extends Error {
  constructor(message = "The request conflicts with existing state.") {
    super(message);
    this.name = "ConflictError";
  }
}

function errorBody(
  kind: ErrorKind,
  message: string,
  issues?: ErrorIssue[],
): ErrorResponseBody {
  return issues
    ? { error: { kind, message, issues } }
    : { error: { kind, message } };
}

/**
 * Hono app-level error handler. Distinguishes client-caused failures
 * (validation) from server-caused ones (internal); internal errors disclose
 * nothing to the client — details are logged server-side instead.
 */
export const errorHandler: ErrorHandler = (err, c: Context) => {
  if (err instanceof ValidationError) {
    return c.json(
      errorBody("validation", err.message, err.issues),
      STATUS_BY_KIND.validation,
    );
  }
  if (err instanceof NotFoundError) {
    return c.json(
      errorBody("not_found", err.message),
      STATUS_BY_KIND.not_found,
    );
  }
  if (err instanceof UnauthorizedError) {
    return c.json(
      errorBody("unauthorized", err.message),
      STATUS_BY_KIND.unauthorized,
    );
  }
  if (err instanceof ForbiddenError) {
    return c.json(
      errorBody("forbidden", err.message),
      STATUS_BY_KIND.forbidden,
    );
  }
  if (err instanceof ConflictError) {
    return c.json(errorBody("conflict", err.message), STATUS_BY_KIND.conflict);
  }

  console.error(err);
  return c.json(
    errorBody("internal", INTERNAL_ERROR_MESSAGE),
    STATUS_BY_KIND.internal,
  );
};

/** Hono app-level not-found handler, for requests to unregistered paths. */
export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(
    errorBody("not_found", "The requested resource was not found."),
    STATUS_BY_KIND.not_found,
  );
