import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { errorEnvelope } from "../errors";
import { isSessionAuthenticated, markSessionAuthenticated } from "./session";

export interface AuthRoutesOptions {
  operatorPasswordHash: string;
}

interface LoginBody {
  password?: string;
}

export function registerAuthRoutes(app: FastifyInstance, opts: AuthRoutesOptions): void {
  app.post<{ Body: LoginBody }>("/api/auth/login", async (request, reply) => {
    const password = request.body?.password;
    const ok = typeof password === "string" && bcrypt.compareSync(password, opts.operatorPasswordHash);

    if (!ok) {
      reply.code(401).send(errorEnvelope("unauthorized", "Sign-in failed."));
      return;
    }

    markSessionAuthenticated(request);
    return { ok: true };
  });

  app.post("/api/auth/logout", async (request) => {
    request.session.delete();
    return { ok: true };
  });

  app.get("/api/auth/session", async (request, reply) => {
    if (!isSessionAuthenticated(request)) {
      reply.code(401).send(errorEnvelope("unauthorized", "Sign-in failed."));
      return;
    }
    return { authenticated: true };
  });
}
