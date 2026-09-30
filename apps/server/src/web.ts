import type { LibraryJob, StacksLoadContext } from "@the-stacks/shared";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { IdentityLookup } from "./auth/identity.js";
import { SESSION_COOKIE_NAME } from "./auth/middleware.js";

export interface CreateWebLoadContextOptions {
  lookup: IdentityLookup;
  /** Newest N jobs, as GET /library/jobs serves them (plan D2). */
  listJobs: (limit: number) => Promise<LibraryJob[]>;
}

/**
 * Builds one `StacksLoadContext` per request (plan D2). `identity()` reads
 * the session cookie and memoizes its result for the lifetime of this
 * context, so a root loader and a later loader on the same request share
 * one lookup instead of paying for it twice. `jobs()` is not memoized: a
 * loader calls it once per request.
 */
export function createWebLoadContext(
  c: Context,
  { lookup, listJobs }: CreateWebLoadContextOptions,
): StacksLoadContext {
  let identity: ReturnType<IdentityLookup> | undefined;
  function getIdentity() {
    if (!identity) {
      identity = lookup(getCookie(c, SESSION_COOKIE_NAME));
    }
    return identity;
  }
  return {
    identity: getIdentity,
    async jobs() {
      const user = await getIdentity();
      if (user?.role !== "operator") return null;
      return listJobs(100);
    },
  };
}
