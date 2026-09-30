/** The two roles session-auth (spec 005) defines: operator or invited player. */
export type Role = "operator" | "player";

/** The user-facing identity shape returned by sign-in, /auth/me, and the load context (plan D3). */
export interface PublicUser {
  id: string;
  displayName: string;
  role: Role;
}

/** Per-request server data offered to React Router loaders (doc-0003 ruling 5). */
export interface StacksLoadContext {
  identity(): Promise<PublicUser | null>;
}

/** The web server bundle's entry; Hono calls it with c.req.raw (plan D4, D5). */
export type WebRequestHandler = (
  request: Request,
  context: StacksLoadContext,
) => Promise<Response>;
