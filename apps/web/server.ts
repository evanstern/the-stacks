import * as build from "virtual:react-router/server-build";
import type { WebRequestHandler } from "@the-stacks/shared";
import { createRequestHandler, RouterContextProvider } from "react-router";
import { stacksContext } from "~/context";

const requestHandler = createRequestHandler(build, process.env.NODE_ENV);

/**
 * Hono calls this with `c.req.raw` and a `StacksLoadContext` (plan D4, D5,
 * research R1). The provider is built here, inside the web bundle, so the
 * context key, the provider, and every loader live in one module graph.
 */
export const handle: WebRequestHandler = (request, loadContext) => {
  const context = new RouterContextProvider();
  context.set(stacksContext, loadContext);
  return requestHandler(request, context);
};
