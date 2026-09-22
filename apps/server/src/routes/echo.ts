import { EchoRequestSchema, EchoResponseSchema } from "@the-stacks/shared";
import { Hono } from "hono";
import type { ZodError } from "zod";
import { ValidationError } from "../errors.js";

function toIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * POST /api/echo — deliberately product-shapeless (research D5); proves the
 * validation seam every later route inherits. See
 * specs/003-hono-server/contracts/echo-route.md.
 */
export function createEchoRoute() {
  const route = new Hono();

  route.post("/", async (c) => {
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      throw new ValidationError([
        { path: "(root)", message: "Request body must be valid JSON." },
      ]);
    }

    const input = EchoRequestSchema.safeParse(json);
    if (!input.success) {
      throw new ValidationError(toIssues(input.error));
    }

    const output = {
      message: input.data.message,
      receivedAt: new Date().toISOString(),
    };

    // Output validation (FR-004): a handler bug must not reach the client
    // as a shape-violating response, so this fails as an internal error
    // rather than being sent as-is.
    const validated = EchoResponseSchema.safeParse(output);
    if (!validated.success) {
      throw new Error("Echo response failed output validation");
    }

    return c.json(validated.data);
  });

  return route;
}
