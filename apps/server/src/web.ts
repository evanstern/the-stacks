import type { StacksLoadContext } from "@the-stacks/shared";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { IdentityLookup } from "./auth/identity.js";
import { SESSION_COOKIE_NAME } from "./auth/middleware.js";

/**
 * Builds one `StacksLoadContext` per request (plan D2). `identity()` reads
 * the session cookie and memoizes its result for the lifetime of this
 * context, so a root loader and a later loader on the same request share
 * one lookup instead of paying for it twice.
 */
export function createWebLoadContext(
  c: Context,
  lookup: IdentityLookup,
): StacksLoadContext {
  let identity: ReturnType<IdentityLookup> | undefined;
  return {
    identity() {
      if (!identity) {
        identity = lookup(getCookie(c, SESSION_COOKIE_NAME));
      }
      return identity;
    },
  };
}
