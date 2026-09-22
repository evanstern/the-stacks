import type { Context, NotFoundHandler } from "hono";
import type { ErrorHandler } from "hono/types";

/** The structured error contract — see specs/003-hono-server/contracts/errors.md */
export type ErrorKind = "validation" | "internal" | "not_found";

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
